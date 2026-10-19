/**
 * FamilyVault Device-to-Device Sync Client (Node.js / Electron / Tests)
 * Performs authenticated ECDH key exchange with PIN and transfers end-to-end encrypted payloads.
 */

import type { VaultAllRecords } from '../../electron/types.ts';
import type {
  DeviceInfo,
  HostSessionInfo,
  PairRequest,
  PairResponse,
  SyncPlan,
  ConflictResolutionPolicy,
  SyncExecutionResult
} from './syncProtocol.ts';
import {
  generateEphemeralKeyPair,
  deriveSessionKeys,
  computeAuthProof,
  verifyAuthProof,
  encryptPayload,
  decryptPayload,
  type SessionKeys,
  type EncryptedPacket
} from './syncCrypto.ts';

export class SyncClient {
  private hostBaseUrl: string = '';
  private sessionInfo: HostSessionInfo | null = null;
  private sessionKeys: SessionKeys | null = null;
  private publicKeyHex: string = '';
  private seqNumOut: number = 0;
  private seqNumIn: number = 0;

  public getSessionInfo(): HostSessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Connects to a Sync Host and completes mutual authenticated key exchange.
   */
  public async connectAndPair(options: {
    hostIp: string;
    port: number;
    pin: string;
    peerDevice: DeviceInfo;
  }): Promise<{ hostDevice: DeviceInfo }> {
    this.hostBaseUrl = `http://${options.hostIp}:${options.port}`;

    // 1. Fetch Host Session Info
    const infoRes = await fetch(`${this.hostBaseUrl}/api/sync/info`);
    if (!infoRes.ok) {
      const err = (await infoRes.json().catch(() => ({ error: 'Connection failed' }))) as { error?: string };
      throw new Error(`Failed to connect to host: ${err.error || infoRes.statusText}`);
    }

    const hostInfo = (await infoRes.json()) as HostSessionInfo;
    this.sessionInfo = hostInfo;

    // Check expiration
    if (Date.now() > hostInfo.expiresAt) {
      throw new Error('Sync session on host has expired. Ask host to start a new session.');
    }

    // 2. Generate Ephemeral ECDH Keypair
    const kp = generateEphemeralKeyPair();
    this.publicKeyHex = kp.publicKeyHex;
    this.seqNumOut = 0;
    this.seqNumIn = 0;

    // 3. Derive Session Keys using PIN and SessionId
    const sessionKeys = deriveSessionKeys(
      kp.ecdh,
      hostInfo.publicKeyHex,
      options.pin.trim(),
      hostInfo.sessionId
    );

    // 4. Compute Peer Auth Proof
    const pinAuthProof = computeAuthProof(
      sessionKeys.macKey,
      'PEER',
      hostInfo.sessionId,
      this.publicKeyHex
    );

    // 5. Send Pairing Request
    const pairReq: PairRequest = {
      sessionId: hostInfo.sessionId,
      peerDevice: options.peerDevice,
      peerPublicKeyHex: this.publicKeyHex,
      pinAuthProof
    };

    const pairRes = await fetch(`${this.hostBaseUrl}/api/sync/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pairReq)
    });

    if (!pairRes.ok) {
      const err = (await pairRes.json().catch(() => ({ error: 'Pairing failed' }))) as { error?: string };
      throw new Error(err.error || 'Pairing rejected. Check 6-digit PIN.');
    }

    const pairData = (await pairRes.json()) as PairResponse;

    // 6. Verify Host Auth Proof
    if (!pairData.hostAuthProof) {
      throw new Error('Host failed to provide mutual authentication proof.');
    }

    const isHostValid = verifyAuthProof(
      sessionKeys.macKey,
      'HOST',
      hostInfo.sessionId,
      hostInfo.publicKeyHex,
      pairData.hostAuthProof
    );

    if (!isHostValid) {
      throw new Error('Cryptographic verification of host failed. Aborting connection.');
    }

    this.sessionKeys = sessionKeys;
    return { hostDevice: hostInfo.hostDevice };
  }

  /**
   * Generates a preview SyncPlan comparing local records against the host's records.
   */
  public async previewSync(localVault: VaultAllRecords): Promise<SyncPlan> {
    if (!this.sessionKeys) {
      throw new Error('Client not paired with host.');
    }

    const encryptedPacket = encryptPayload(
      localVault,
      this.sessionKeys.encKey,
      this.seqNumOut++
    );

    const res = await fetch(`${this.hostBaseUrl}/api/sync/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encryptedPacket)
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Failed to preview sync' }))) as { error?: string };
      throw new Error(err.error || 'Failed to preview sync');
    }

    const encryptedResp = (await res.json()) as EncryptedPacket;
    return decryptPayload<SyncPlan>(
      encryptedResp,
      this.sessionKeys.encKey,
      this.seqNumIn++
    );
  }

  /**
   * Pushes local records to host and commits according to conflict policy.
   */
  public async pushSync(
    localVault: VaultAllRecords,
    policy: ConflictResolutionPolicy,
    manualChoices?: Record<string, 'local' | 'remote'>
  ): Promise<SyncExecutionResult> {
    if (!this.sessionKeys) {
      throw new Error('Client not paired with host.');
    }

    const payload = {
      vault: localVault,
      policy,
      manualChoices
    };

    const encryptedPacket = encryptPayload(
      payload,
      this.sessionKeys.encKey,
      this.seqNumOut++
    );

    const res = await fetch(`${this.hostBaseUrl}/api/sync/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encryptedPacket)
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Sync transfer failed' }))) as { error?: string };
      throw new Error(err.error || 'Sync transfer failed on host');
    }

    const encryptedResp = (await res.json()) as EncryptedPacket;
    return decryptPayload<SyncExecutionResult>(
      encryptedResp,
      this.sessionKeys.encKey,
      this.seqNumIn++
    );
  }
}
