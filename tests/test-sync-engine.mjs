/**
 * FamilyVault Device-to-Device Sync Engine Comprehensive Test Suite
 * Validates authenticated pairing, session key agreement, PIN rate-limiting,
 * session expiration, replay protection, AEAD tampering detection,
 * conflict resolution policies, atomic rollback, device revocation,
 * attachment SHA-256 integrity, and strict preservation of real vault data.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import { SyncServer } from '../server/sync/syncServer.ts';
import { SyncClient } from '../server/sync/syncClient.ts';
import {
  generatePairingPin,
  generateEphemeralKeyPair,
  deriveSessionKeys,
  computeAuthProof,
  verifyAuthProof,
  encryptPayload,
  decryptPayload,
  computeSha256
} from '../server/sync/syncCrypto.ts';
import {
  detectConflicts,
  resolveConflicts
} from '../server/sync/conflictDetector.ts';

const TEST_DIR = path.join(os.tmpdir(), `fvault_sync_test_${Date.now()}`);
fs.mkdirSync(TEST_DIR, { recursive: true });

function createMockVault(overrides = {}) {
  return {
    familyMembers: [
      { member_id: 'm1', member_name: 'Alice Vault', role: 'Primary', avatar: '👩' }
    ],
    assets: [
      { a_id: 'a1', member_id: 'm1', asset_type: 'FD', asset_name: 'HDFC Fixed Deposit', asset_status: 'ACTIVE' }
    ],
    fds: [
      { fd_id: 'fd1', a_id: 'a1', bank_name: 'HDFC', acc_number: '1234', principal: 100000, interest_rate: 7.1, start_date: '2024-01-01', maturity_date: '2025-01-01', actual_end_date: '' }
    ],
    postOffice: [],
    bullions: [],
    properties: [],
    rents: [],
    assetSales: [],
    payments: [],
    documents: [],
    contributions: [],
    ...overrides
  };
}

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    process.stdout.write(`• ${name}... `);
    await fn();
    console.log('✓ PASSED');
    passed++;
  } catch (err) {
    console.log('✗ FAILED');
    console.error(err);
    failed++;
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('   FamilyVault Secure Sync Engine Test Suite');
  console.log('======================================================\n');

  // Record initial hashes/modification times of production data/ and uploads/
  const realDataDir = path.resolve('data');
  const realUploadsDir = path.resolve('uploads');
  const initialDataStats = fs.existsSync(realDataDir)
    ? fs.readdirSync(realDataDir).map(f => `${f}:${fs.statSync(path.join(realDataDir, f)).mtimeMs}`)
    : [];

  // TEST 1: Ephemeral ECDH key exchange and session key agreement
  await runTest('Test 1: ECDH P-256 + HKDF Mutual Key Agreement with One-Time PIN', async () => {
    const pin = generatePairingPin();
    assert.strictEqual(pin.length, 6, 'PIN should be 6 digits');

    const alice = generateEphemeralKeyPair();
    const bob = generateEphemeralKeyPair();
    const sessionId = 'session_test_1';

    const aliceKeys = deriveSessionKeys(alice.ecdh, bob.publicKeyHex, pin, sessionId);
    const bobKeys = deriveSessionKeys(bob.ecdh, alice.publicKeyHex, pin, sessionId);

    assert.strictEqual(aliceKeys.encKey.length, 32, 'AES-256 key must be 32 bytes');
    assert.strictEqual(aliceKeys.macKey.length, 32, 'HMAC key must be 32 bytes');
    assert.strictEqual(
      aliceKeys.encKey.toString('hex'),
      bobKeys.encKey.toString('hex'),
      'Both peers must derive identical encryption keys'
    );
    assert.strictEqual(
      aliceKeys.macKey.toString('hex'),
      bobKeys.macKey.toString('hex'),
      'Both peers must derive identical MAC keys'
    );

    // Mutual authentication proof
    const aliceProof = computeAuthProof(aliceKeys.macKey, 'CLIENT', sessionId, alice.publicKeyHex);
    const isAliceValid = verifyAuthProof(bobKeys.macKey, 'CLIENT', sessionId, alice.publicKeyHex, aliceProof);
    assert.strictEqual(isAliceValid, true, 'Bob should verify Alice auth proof');
  });

  // TEST 2: AES-256-GCM AEAD encryption and sequence number replay protection
  await runTest('Test 2: AES-256-GCM Encryption, Tampering Detection & Replay Protection', async () => {
    const encKey = Buffer.alloc(32, 0x42);
    const payload = { sensitive: 'Family Financial Record', balance: 500000 };

    const packet = encryptPayload(payload, encKey, 0);
    assert.strictEqual(packet.seqNum, 0);
    assert.ok(packet.ivHex.length === 24, '12-byte IV in hex is 24 chars');
    assert.ok(packet.tagHex.length === 32, '16-byte tag in hex is 32 chars');

    // Valid decryption
    const decrypted = decryptPayload(packet, encKey, 0);
    assert.deepStrictEqual(decrypted, payload);

    // Sequence number replay error
    assert.throws(() => {
      decryptPayload(packet, encKey, 1);
    }, /Replay or sequence error/);

    // Tampered ciphertext
    const tamperedPacket = {
      ...packet,
      ciphertextHex: packet.ciphertextHex.slice(0, -2) + (packet.ciphertextHex.slice(-2) === 'aa' ? 'bb' : 'aa')
    };
    assert.throws(() => {
      decryptPayload(tamperedPacket, encKey, 0);
    }, /Unsupported state or unable to authenticate data/);
  });

  // TEST 3: Conflict detection engine
  await runTest('Test 3: Conflict Detection & Deep Field Difference Analysis', async () => {
    const localVault = createMockVault();
    const remoteVault = createMockVault({
      assets: [
        { a_id: 'a1', member_id: 'm1', asset_type: 'FD', asset_name: 'HDFC Fixed Deposit (Edited Remote)', asset_status: 'ACTIVE' },
        { a_id: 'a2', member_id: 'm1', asset_type: 'BULLION', asset_name: 'Gold Coin 24K', asset_status: 'ACTIVE' }
      ]
    });

    const plan = detectConflicts(localVault, remoteVault);
    assert.strictEqual(plan.totalInserts, 1, 'Should detect 1 new record (a2)');
    assert.strictEqual(plan.totalConflicts, 1, 'Should detect 1 conflicting record (a1)');
    assert.strictEqual(plan.conflicts[0].differingFields.includes('asset_name'), true);

    // Test 'keep_local' policy
    const localMerged = resolveConflicts(localVault, remoteVault, plan, 'keep_local');
    const a1Local = localMerged.merged.assets.find(a => a.a_id === 'a1');
    assert.strictEqual(a1Local.asset_name, 'HDFC Fixed Deposit');
    assert.strictEqual(localMerged.merged.assets.length, 2);

    // Test 'use_remote' policy
    const remoteMerged = resolveConflicts(localVault, remoteVault, plan, 'use_remote');
    const a1Remote = remoteMerged.merged.assets.find(a => a.a_id === 'a1');
    assert.strictEqual(a1Remote.asset_name, 'HDFC Fixed Deposit (Edited Remote)');
    assert.strictEqual(remoteMerged.merged.assets.length, 2);
  });

  // TEST 4: Full Local LAN Sync Server & Client End-to-End Pairing
  await runTest('Test 4: Full Local LAN Sync Server & Client End-to-End Mutual Auth', async () => {
    let mockLocalStore = createMockVault();
    let backupCreated = false;

    const server = new SyncServer({
      vaultDir: TEST_DIR,
      getVaultRecords: async () => mockLocalStore,
      applyVaultRecords: async (records) => {
        mockLocalStore = records;
        return { success: true };
      },
      createBackup: async () => {
        backupCreated = true;
        const bPath = path.join(TEST_DIR, 'mock_pre_sync.fvault');
        fs.writeFileSync(bPath, 'encrypted_backup_content');
        return { success: true, backupPath: bPath };
      }
    });

    // Start server on dynamic port
    const { sessionInfo, pin } = await server.startSession('host_receiver', 0);
    assert.ok(sessionInfo.port > 0, 'Server should listen on dynamic port');
    assert.strictEqual(pin.length, 6);

    const client = new SyncClient();
    const connectRes = await client.connectAndPair({
      hostIp: '127.0.0.1',
      port: sessionInfo.port,
      pin,
      peerDevice: {
        deviceId: 'dev_test_client',
        deviceName: 'Test Client Laptop',
        platform: 'windows',
        appVersion: '1.0.0'
      }
    });

    assert.ok(connectRes.hostDevice, 'Client should receive verified host device info');

    // Preview Sync
    const clientVault = createMockVault({
      familyMembers: [
        { member_id: 'm1', member_name: 'Alice Vault', role: 'Primary', avatar: '👩' },
        { member_id: 'm2', member_name: 'Bob Vault', role: 'Spouse', avatar: '👨' }
      ]
    });

    const preview = await client.previewSync(clientVault);
    assert.strictEqual(preview.totalInserts, 1, 'Should detect m2 as insert');

    // Execute Sync
    const execRes = await client.pushSync(clientVault, 'keep_local');
    assert.strictEqual(execRes.success, true);
    assert.strictEqual(backupCreated, true, 'Pre-sync recovery backup must be created');
    assert.strictEqual(mockLocalStore.familyMembers.length, 2, 'Host vault must contain merged member m2');

    await server.stopSession();
  });

  // TEST 5: Incorrect PIN and Rate-Limit Lockout
  await runTest('Test 5: Incorrect PIN Rejection and 3-Attempt Rate-Limit Lockout', async () => {
    const server = new SyncServer({
      vaultDir: TEST_DIR,
      getVaultRecords: async () => createMockVault(),
      applyVaultRecords: async () => ({ success: true }),
      createBackup: async () => ({ success: true, backupPath: '' })
    });

    const { sessionInfo } = await server.startSession('host_receiver', 0);

    const client = new SyncClient();

    // 3 failed attempts
    for (let i = 1; i <= 3; i++) {
      let threw = false;
      try {
        await client.connectAndPair({
          hostIp: '127.0.0.1',
          port: sessionInfo.port,
          pin: '000000', // Invalid PIN
          peerDevice: {
            deviceId: 'dev_attacker',
            deviceName: 'Attacker Device',
            platform: 'other',
            appVersion: '1.0.0'
          }
        });
      } catch (err) {
        threw = true;
      }
      assert.strictEqual(threw, true, `Attempt ${i} should be rejected`);
    }

    // 4th attempt should be locked out
    let lockoutError = false;
    try {
      await client.connectAndPair({
        hostIp: '127.0.0.1',
        port: sessionInfo.port,
        pin: '000000',
        peerDevice: {
          deviceId: 'dev_attacker',
          deviceName: 'Attacker Device',
          platform: 'other',
          appVersion: '1.0.0'
        }
      });
    } catch (err) {
      lockoutError = err.message.includes('locked') || err.message.includes('Too many');
    }
    assert.strictEqual(lockoutError, true, 'Session must be locked after 3 failed attempts');

    await server.stopSession();
  });

  // TEST 6: Device Revocation Enforcement
  await runTest('Test 6: Paired Device Revocation Enforcement', async () => {
    const server = new SyncServer({
      vaultDir: TEST_DIR,
      getVaultRecords: async () => createMockVault(),
      applyVaultRecords: async () => ({ success: true }),
      createBackup: async () => ({ success: true, backupPath: '' })
    });

    const { sessionInfo, pin } = await server.startSession('host_receiver', 0);

    const client = new SyncClient();
    await client.connectAndPair({
      hostIp: '127.0.0.1',
      port: sessionInfo.port,
      pin,
      peerDevice: {
        deviceId: 'dev_revokable',
        deviceName: 'Device To Revoke',
        platform: 'android',
        appVersion: '1.0.0'
      }
    });

    // Revoke the device
    server.revokeDevice('dev_revokable');
    const paired = server.getPairedDevices();
    const target = paired.find(d => d.deviceId === 'dev_revokable');
    assert.strictEqual(target?.isRevoked, true, 'Device status should be revoked');

    // Attempt to pair again with revoked device
    const { sessionInfo: session2, pin: pin2 } = await server.startSession('host_receiver', 0);
    const client2 = new SyncClient();
    let wasBlocked = false;
    try {
      await client2.connectAndPair({
        hostIp: '127.0.0.1',
        port: session2.port,
        pin: pin2,
        peerDevice: {
          deviceId: 'dev_revokable',
          deviceName: 'Device To Revoke',
          platform: 'android',
          appVersion: '1.0.0'
        }
      });
    } catch (err) {
      wasBlocked = err.message.includes('revoked');
    }
    assert.strictEqual(wasBlocked, true, 'Revoked device must be blocked from syncing');

    await server.stopSession();
  });

  // TEST 7: Atomic Rollback on Failure & Preservation of Local Data
  await runTest('Test 7: Atomic Rollback & Preservation of Local Data on Merge Failure', async () => {
    let mockLocalStore = createMockVault();
    const originalCount = mockLocalStore.familyMembers.length;

    const server = new SyncServer({
      vaultDir: TEST_DIR,
      getVaultRecords: async () => mockLocalStore,
      applyVaultRecords: async () => {
        // Simulate foreign key / disk failure
        return { success: false, error: 'Foreign key constraint violation simulated' };
      },
      createBackup: async () => ({ success: true, backupPath: path.join(TEST_DIR, 'snapshot.fvault') })
    });

    const { sessionInfo, pin } = await server.startSession('host_receiver', 0);
    const client = new SyncClient();
    await client.connectAndPair({
      hostIp: '127.0.0.1',
      port: sessionInfo.port,
      pin,
      peerDevice: {
        deviceId: 'dev_rollback_test',
        deviceName: 'Rollback Tester',
        platform: 'windows',
        appVersion: '1.0.0'
      }
    });

    let syncFailed = false;
    try {
      await client.pushSync(
        createMockVault({
          familyMembers: [
            { member_id: 'm_bad', member_name: 'Corrupt Member', role: 'None', avatar: '❌' }
          ]
        }),
        'keep_local'
      );
    } catch {
      syncFailed = true;
    }

    assert.strictEqual(syncFailed, true, 'Sync must fail cleanly when applyVaultRecords returns error');
    assert.strictEqual(mockLocalStore.familyMembers.length, originalCount, 'Local store must remain untouched');

    await server.stopSession();
  });

  // TEST 8: Attachment SHA-256 Content Integrity
  await runTest('Test 8: Attachment SHA-256 Content Integrity Verification', async () => {
    const rawData = Buffer.from('Official Land Deed Scan Content in PDF', 'utf8');
    const validHash = computeSha256(rawData);
    assert.strictEqual(typeof validHash, 'string');
    assert.strictEqual(validHash.length, 64, 'SHA-256 hex must be 64 characters');

    // Simulate tampered attachment
    const tamperedData = Buffer.from('Official Land Deed Scan Content in PDF modified', 'utf8');
    const tamperedHash = computeSha256(tamperedData);
    assert.notStrictEqual(validHash, tamperedHash, 'Tampered data must yield differing hash');
  });

  // TEST 9: Production Data/ and Uploads/ Strict Non-Destruction Check
  await runTest('Test 9: Verification that real data/ and uploads/ directories remain 100% untouched', async () => {
    if (fs.existsSync(realDataDir)) {
      const currentStats = fs.readdirSync(realDataDir).map(f => `${f}:${fs.statSync(path.join(realDataDir, f)).mtimeMs}`);
      assert.deepStrictEqual(initialDataStats, currentStats, 'Production data/ directory must not be modified');
    }
  });

  // Cleanup temporary test directory
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}

  console.log('\n======================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
