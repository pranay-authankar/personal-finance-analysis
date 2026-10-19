/**
 * FamilyVault Local LAN Sync Server (Node.js / Electron Main)
 * Implements ephemeral PAKE pairing, zero-trust local transport,
 * replay protection, and transactional merge coordination.
 */

import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { VaultAllRecords } from '../../electron/types.ts';
import {
  DEFAULT_SYNC_PORT,
  PAIRING_TIMEOUT_MS,
  MAX_PIN_ATTEMPTS,
  type DeviceInfo,
  type HostSessionInfo,
  type PairRequest,
  type PairResponse,
  type PairedDevice,
  type SyncRole,
  type ConflictResolutionPolicy
} from './syncProtocol.ts';
import {
  generatePairingPin,
  generateEphemeralKeyPair,
  deriveSessionKeys,
  computeAuthProof,
  verifyAuthProof,
  encryptPayload,
  decryptPayload,
  type KeyPair,
  type SessionKeys,
  type EncryptedPacket
} from './syncCrypto.ts';
import { detectConflicts, resolveConflicts } from './conflictDetector.ts';

export interface SyncServerOptions {
  vaultDir: string;
  getVaultRecords: () => Promise<VaultAllRecords>;
  applyVaultRecords: (records: VaultAllRecords) => Promise<{ success: boolean; error?: string }>;
  createBackup: () => Promise<{ success: boolean; backupPath: string }>;
  deviceInfo?: Partial<DeviceInfo>;
}

export class SyncServer {
  private options: SyncServerOptions;
  private server: http.Server | null = null;
  private currentSession: {
    sessionId: string;
    pin: string;
    role: SyncRole;
    keyPair: KeyPair;
    publicKeyHex: string;
    expiresAt: number;
    pinAttempts: number;
    sessionKeys?: SessionKeys;
    pairedPeer?: DeviceInfo;
    seqNumIn: number;
    seqNumOut: number;
  } | null = null;

  private pairedDevicesFile: string;
  private pairedDevices: Map<string, PairedDevice> = new Map();

  constructor(options: SyncServerOptions) {
    this.options = options;
    this.pairedDevicesFile = path.join(this.options.vaultDir, 'paired_devices.json');
    this.loadPairedDevices();
  }

  private loadPairedDevices(): void {
    try {
      if (fs.existsSync(this.pairedDevicesFile)) {
        const raw = fs.readFileSync(this.pairedDevicesFile, 'utf8');
        const list = JSON.parse(raw) as PairedDevice[];
        for (const dev of list) {
          this.pairedDevices.set(dev.deviceId, dev);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  private savePairedDevices(): void {
    try {
      const list = Array.from(this.pairedDevices.values());
      fs.writeFileSync(this.pairedDevicesFile, JSON.stringify(list, null, 2), 'utf8');
    } catch {
      // Ignore write errors in tests
    }
  }

  public getPairedDevices(): PairedDevice[] {
    return Array.from(this.pairedDevices.values());
  }

  public revokeDevice(deviceId: string): boolean {
    const dev = this.pairedDevices.get(deviceId);
    if (dev) {
      dev.isRevoked = true;
      this.savePairedDevices();
      return true;
    }
    return false;
  }

  /**
   * Discovers primary local LAN IPv4 addresses.
   */
  public getLocalIps(): string[] {
    const ips: string[] = [];
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      const netList = nets[name];
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }
    return ips.length > 0 ? ips : ['127.0.0.1'];
  }

  /**
   * Starts a new ephemeral sync session and starts listening on LAN.
   */
  public async startSession(
    role: SyncRole = 'host_receiver',
    preferredPort: number = DEFAULT_SYNC_PORT
  ): Promise<{ sessionInfo: HostSessionInfo; pin: string }> {
    await this.stopSession();

    const pin = generatePairingPin();
    const kp = generateEphemeralKeyPair();
    const sessionId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = Date.now() + PAIRING_TIMEOUT_MS;

    this.currentSession = {
      sessionId,
      pin,
      role,
      keyPair: kp,
      publicKeyHex: kp.publicKeyHex,
      expiresAt,
      pinAttempts: 0,
      seqNumIn: 0,
      seqNumOut: 0
    };

    const port = await this.listen(preferredPort);
    const hostIps = this.getLocalIps();

    const hostDevice: DeviceInfo = {
      deviceId: this.options.deviceInfo?.deviceId || `host_${os.hostname()}`,
      deviceName: this.options.deviceInfo?.deviceName || os.hostname(),
      platform: (process.platform === 'win32' ? 'windows' : 'other'),
      appVersion: '1.0.0'
    };

    const sessionInfo: HostSessionInfo = {
      sessionId,
      hostDevice,
      port,
      hostIps,
      publicKeyHex: kp.publicKeyHex,
      expiresAt
    };

    return { sessionInfo, pin };
  }

  private listen(preferredPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Fall back to dynamic port
          this.server?.listen(0, '0.0.0.0', () => {
            const addr = this.server?.address() as AddressInfo;
            resolve(addr.port);
          });
        } else {
          reject(err);
        }
      });

      this.server.listen(preferredPort, '0.0.0.0', () => {
        const addr = this.server?.address() as AddressInfo;
        resolve(addr.port);
      });
    });
  }

  public stopSession(): Promise<void> {
    return new Promise(resolve => {
      if (this.currentSession) {
        this.currentSession = null;
      }
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '';

    try {
      if (req.method === 'GET' && url === '/api/sync/info') {
        this.handleGetInfo(res);
      } else if (req.method === 'POST' && url === '/api/sync/pair') {
        await this.handlePair(req, res);
      } else if (req.method === 'POST' && url === '/api/sync/plan') {
        await this.handlePlan(req, res);
      } else if (req.method === 'POST' && url === '/api/sync/transfer') {
        await this.handleTransfer(req, res);
      } else if (req.method === 'POST' && url === '/api/sync/confirm') {
        await this.handleConfirm(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  }

  private handleGetInfo(res: http.ServerResponse): void {
    if (!this.currentSession) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active sync session' }));
      return;
    }

    if (Date.now() > this.currentSession.expiresAt) {
      res.writeHead(408, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Sync session expired' }));
      return;
    }

    const addr = this.server?.address() as AddressInfo;
    const hostDevice: DeviceInfo = {
      deviceId: this.options.deviceInfo?.deviceId || `host_${os.hostname()}`,
      deviceName: this.options.deviceInfo?.deviceName || os.hostname(),
      platform: (process.platform === 'win32' ? 'windows' : 'other'),
      appVersion: '1.0.0'
    };

    const info: HostSessionInfo = {
      sessionId: this.currentSession.sessionId,
      hostDevice,
      port: addr ? addr.port : DEFAULT_SYNC_PORT,
      hostIps: this.getLocalIps(),
      publicKeyHex: this.currentSession.publicKeyHex,
      expiresAt: this.currentSession.expiresAt
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info));
  }

  private async handlePair(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.currentSession) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active sync session' }));
      return;
    }

    if (Date.now() > this.currentSession.expiresAt) {
      res.writeHead(408, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Sync session expired' }));
      return;
    }

    if (this.currentSession.pinAttempts >= MAX_PIN_ATTEMPTS) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many incorrect PIN attempts. Session locked.' }));
      return;
    }

    const body = await this.readJsonBody<PairRequest>(req);

    if (body.sessionId !== this.currentSession.sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid session ID' }));
      return;
    }

    // Check device revocation
    const existing = this.pairedDevices.get(body.peerDevice.deviceId);
    if (existing && existing.isRevoked) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device has been revoked and cannot sync.' }));
      return;
    }

    // Derive session keys using PIN
    let sessionKeys: SessionKeys;
    try {
      sessionKeys = deriveSessionKeys(
        this.currentSession.keyPair.ecdh,
        body.peerPublicKeyHex,
        this.currentSession.pin,
        this.currentSession.sessionId
      );
    } catch {
      this.currentSession.pinAttempts++;
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Key agreement failed' }));
      return;
    }

    // Verify peer's auth proof
    const isPeerValid = verifyAuthProof(
      sessionKeys.macKey,
      'PEER',
      this.currentSession.sessionId,
      body.peerPublicKeyHex,
      body.pinAuthProof
    );

    if (!isPeerValid) {
      this.currentSession.pinAttempts++;
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Incorrect pairing PIN. Access denied.' }));
      return;
    }

    // Pairing succeeded: record session keys and register peer
    this.currentSession.sessionKeys = sessionKeys;
    this.currentSession.pairedPeer = body.peerDevice;

    this.pairedDevices.set(body.peerDevice.deviceId, {
      deviceId: body.peerDevice.deviceId,
      deviceName: body.peerDevice.deviceName,
      platform: body.peerDevice.platform,
      pairedAt: new Date().toISOString(),
      isRevoked: false
    });
    this.savePairedDevices();

    // Compute host auth proof to send back
    const hostAuthProof = computeAuthProof(
      sessionKeys.macKey,
      'HOST',
      this.currentSession.sessionId,
      this.currentSession.publicKeyHex
    );

    const resp: PairResponse = {
      success: true,
      hostAuthProof
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(resp));
  }

  private async handlePlan(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.currentSession || !this.currentSession.sessionKeys) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized. Pair first.' }));
      return;
    }

    const packet = await this.readJsonBody<EncryptedPacket>(req);
    const remoteVault = decryptPayload<VaultAllRecords>(
      packet,
      this.currentSession.sessionKeys.encKey,
      this.currentSession.seqNumIn++
    );

    const localVault = await this.options.getVaultRecords();
    const plan = detectConflicts(localVault, remoteVault);

    const encryptedPlan = encryptPayload(
      plan,
      this.currentSession.sessionKeys.encKey,
      this.currentSession.seqNumOut++
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(encryptedPlan));
  }

  private async handleTransfer(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.currentSession || !this.currentSession.sessionKeys) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized. Pair first.' }));
      return;
    }

    const packet = await this.readJsonBody<EncryptedPacket>(req);
    const payload = decryptPayload<{
      vault: VaultAllRecords;
      policy: ConflictResolutionPolicy;
      manualChoices?: Record<string, 'local' | 'remote'>;
    }>(packet, this.currentSession.sessionKeys.encKey, this.currentSession.seqNumIn++);

    const localVault = await this.options.getVaultRecords();
    const plan = detectConflicts(localVault, payload.vault);

    // 1. Create Pre-Sync Backup Snapshot
    const backupRes = await this.options.createBackup();

    // 2. Resolve conflicts according to user policy
    const { merged, recordsInserted, recordsUpdated, recordsPreserved } = resolveConflicts(
      localVault,
      payload.vault,
      plan,
      payload.policy,
      payload.manualChoices
    );

    // 3. Atomically apply merged records to local encrypted vault
    const applyRes = await this.options.applyVaultRecords(merged);

    if (!applyRes.success) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      const encErr = encryptPayload(
        { success: false, error: applyRes.error },
        this.currentSession.sessionKeys.encKey,
        this.currentSession.seqNumOut++
      );
      res.end(JSON.stringify(encErr));
      return;
    }

    // 4. Return success execution report
    const result = {
      success: true,
      recordsInserted,
      recordsUpdated,
      recordsPreserved,
      backupPath: backupRes.backupPath
    };

    const encResult = encryptPayload(
      result,
      this.currentSession.sessionKeys.encKey,
      this.currentSession.seqNumOut++
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(encResult));
  }

  private async handleConfirm(res: http.ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  private readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          reject(new Error('Invalid JSON in request body'));
        }
      });
      req.on('error', reject);
    });
  }
}
