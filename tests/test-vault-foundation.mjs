import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { CRYPTO_CONFIG } from '../server/config.ts';
import {
  deriveEncryptionKey,
  deriveDocumentSubkey,
  generateSalt,
  wipeBuffer
} from '../server/storage/crypto.ts';
import {
  openEncryptedDatabase,
  initializeSchema,
  SqliteStorageEngine
} from '../server/storage/sqliteAdapter.ts';
import { EncryptedDocumentStorage } from '../server/storage/documentStorage.ts';
import { VaultBackupRestoreManager } from '../server/storage/backupManager.ts';
import { isLoopbackRequest, isValidOriginAndHost } from '../server/security.ts';
import { ALL_TABLE_NAMES } from '../server/storage/schema.ts';

console.log('================================================================');
console.log('  FamilyVault — Encrypted Storage Foundation Test Suite         ');
console.log('================================================================\n');

const TEST_DIR = path.resolve('./temp_vault_test_run');
if (fs.existsSync(TEST_DIR)) {
  fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}
fs.mkdirSync(TEST_DIR, { recursive: true });

const testDbPath = path.join(TEST_DIR, 'test_vault.db');
const testMetaPath = path.join(TEST_DIR, 'vault_meta.json');
const testDocsDir = path.join(TEST_DIR, 'attachments');
const testBackupsDir = path.join(TEST_DIR, 'backups');

// -----------------------------------------------------------------------------
// Test 1: PBKDF2-HMAC-SHA512 Key Derivation
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing PBKDF2-HMAC-SHA512 key derivation & validation...');
assert.throws(
  () => deriveEncryptionKey('short', generateSalt()),
  /at least 8 characters/,
  'Short password must be rejected'
);

const masterPassphrase = 'CorrectVaultMasterPassphrase!2026';
const salt = generateSalt();
assert.strictEqual(salt.length, 32, 'Salt must be 32 bytes');

const keyBuffer = deriveEncryptionKey(masterPassphrase, salt);
assert.strictEqual(keyBuffer.length, 32, 'Derived Master Encryption Key must be exactly 32 bytes (256-bit)');
const keyHex = keyBuffer.toString('hex');
console.log('  [PASS] Key derivation generated 256-bit MEK via PBKDF2-HMAC-SHA512 (600,000 iterations).\n');

// -----------------------------------------------------------------------------
// Test 2: Encrypted SQLite Database Creation & Raw Disk Inspection
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing encrypted database creation & disk ciphertext verification...');
const db = openEncryptedDatabase(testDbPath, keyHex);
initializeSchema(db);

const sensitiveSecret = 'TopSecretSyntheticAccountBalance_99999999';
const sensitiveUserName = 'Confidential_Family_Member_Name_Test';

db.exec(`
  INSERT INTO family_members (member_id, member_name, role)
  VALUES ('mem_sec_1', '${sensitiveUserName}', 'Primary Member');

  INSERT INTO assets (a_id, member_id, asset_type, asset_name, asset_status)
  VALUES ('ast_sec_1', 'mem_sec_1', 'FD', '${sensitiveSecret}', 'ACTIVE');
`);
db.close();

// Inspect raw bytes on disk
const rawDiskBytes = fs.readFileSync(testDbPath);
const diskString = rawDiskBytes.toString('latin1');

assert(!diskString.includes(sensitiveSecret), 'FAIL: Sensitive secret found in plaintext on disk!');
assert(!diskString.includes(sensitiveUserName), 'FAIL: Sensitive user name found in plaintext on disk!');
assert(!diskString.includes('family_members'), 'FAIL: Table name found in plaintext on disk!');
assert(!diskString.includes('mem_sec_1'), 'FAIL: Member ID found in plaintext on disk!');

console.log('  [PASS] Confirmed raw disk file contains ZERO plaintext (genuine SQLCipher encryption).\n');

// -----------------------------------------------------------------------------
// Test 3: Rejection of Incorrect Master Password / Key
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing rejection of incorrect master password...');
const wrongPassphrase = 'WrongMasterPassphrase!9999';
const wrongKey = deriveEncryptionKey(wrongPassphrase, salt).toString('hex');

let rejected = false;
let wrongDb = null;
try {
  wrongDb = openEncryptedDatabase(testDbPath, wrongKey);
  const isValid = wrongDb.verifyConnection();
  if (!isValid) {
    rejected = true;
  }
} catch {
  rejected = true;
} finally {
  if (wrongDb) {
    try { wrongDb.close(); } catch {}
  }
}

assert(rejected, 'FAIL: Database should NOT open or query with incorrect key!');
console.log('  [PASS] Opening with incorrect key was cryptographically rejected.\n');

// -----------------------------------------------------------------------------
// Test 4: Reopening with Correct Key & Retrieving Data
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing reopening with correct master password...');
const reopenDb = openEncryptedDatabase(testDbPath, keyHex);
assert(reopenDb.verifyConnection(), 'Connection with correct key must be valid');

const memberRow = reopenDb.prepare("SELECT * FROM family_members WHERE member_id = 'mem_sec_1'").get();
assert.strictEqual(memberRow?.member_name, sensitiveUserName, 'Decrypted member name must match original');

const assetRow = reopenDb.prepare("SELECT * FROM assets WHERE a_id = 'ast_sec_1'").get();
assert.strictEqual(assetRow?.asset_name, sensitiveSecret, 'Decrypted asset name must match original');
reopenDb.close();

console.log('  [PASS] Successfully reopened database and verified exact data decryption.\n');

// -----------------------------------------------------------------------------
// Test 5: Full 11 Relational Tables & Indexes
// -----------------------------------------------------------------------------
console.log('[TEST 5] Verifying all 11 relational tables and indexes...');
const schemaDb = openEncryptedDatabase(testDbPath, keyHex);
const tableRows = schemaDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").all();
const existingTables = tableRows.map((r) => r.name);

for (const tableName of ALL_TABLE_NAMES) {
  assert(
    existingTables.includes(tableName),
    `FAIL: Expected table "${tableName}" not found in schema`
  );
}

const indexRows = schemaDb.prepare("SELECT name FROM sqlite_master WHERE type='index';").all();
assert(indexRows.length >= 10, 'FAIL: Foreign key indexes must be created');
schemaDb.close();

console.log(`  [PASS] Verified all 11 domain tables + migration ledger exist with ${indexRows.length} indexes.\n`);

// -----------------------------------------------------------------------------
// Test 6: Foreign-Key Enforcement & Cascading Constraints
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing foreign-key enforcement & relational constraints...');
const fkDb = openEncryptedDatabase(testDbPath, keyHex);
const fkActive = fkDb.pragma('foreign_keys', { simple: true });
assert.strictEqual(fkActive, 1, 'foreign_keys pragma must be active (1)');

// Try inserting orphan asset without valid member_id
let orphanBlocked = false;
try {
  fkDb.prepare("INSERT INTO assets (a_id, member_id, asset_type, asset_name, asset_status) VALUES ('ast_orphan', 'non_existent_mem', 'FD', 'Orphan', 'ACTIVE')").run();
} catch (err) {
  orphanBlocked = true;
  console.log(`  -> Foreign-key constraint correctly caught orphan insert: ${err.message}`);
}
assert(orphanBlocked, 'FAIL: Orphan asset insert must violate foreign key constraint');

// Insert valid child record (FD linked to asset)
fkDb.prepare(`
  INSERT INTO fds (fd_id, a_id, bank_name, acc_number, principal, interest_rate, start_date, maturity_date)
  VALUES ('fd_rel_1', 'ast_sec_1', 'HDFC Bank', '•••• 4321', 250000, 7.25, '2026-01-01', '2027-01-01')
`).run();

const fdRecord = fkDb.prepare("SELECT * FROM fds WHERE fd_id = 'fd_rel_1'").get();
assert.strictEqual(fdRecord?.principal, 250000);
assert.strictEqual(fdRecord?.interest_rate, 7.25);
fkDb.close();

console.log('  [PASS] Foreign-key constraints and relational integrity verified.\n');

// -----------------------------------------------------------------------------
// Test 7: In-Memory Key Buffer Wiping
// -----------------------------------------------------------------------------
console.log('[TEST 7] Testing in-memory key buffer wiping (memory zeroing on lock)...');
const sensitiveBuffer = Buffer.from('UltraSensitiveSecretKeyMaterial!');
assert.notStrictEqual(sensitiveBuffer[0], 0);
wipeBuffer(sensitiveBuffer);
assert.strictEqual(sensitiveBuffer[0], 0, 'Buffer byte 0 must be zeroed');
assert.strictEqual(sensitiveBuffer[sensitiveBuffer.length - 1], 0, 'Buffer last byte must be zeroed');

console.log('  [PASS] Buffer memory wiping verified.\n');

// -----------------------------------------------------------------------------
// Test 8: Encrypted Document Attachment Storage (AES-256-GCM)
// -----------------------------------------------------------------------------
console.log('[TEST 8] Testing encrypted document attachment storage (AES-256-GCM)...');
const docStorage = new EncryptedDocumentStorage(testDocsDir);
const syntheticPdfContent = Buffer.from('%PDF-1.4 Synthetic Deed & Sale Document with Sensitive Personal Identification Data 12345');
const docId = 'doc_test_deed_1';

const storedMeta = await docStorage.storeEncryptedDocument(
  docId,
  'Property_Sale_Deed.pdf',
  syntheticPdfContent,
  keyBuffer,
  'application/pdf'
);

assert.strictEqual(storedMeta.docId, docId);
assert(fs.existsSync(path.join(testDocsDir, `${docId}.enc`)), 'Encrypted document file must exist on disk');

// Verify disk file is ciphertext
const docDiskBytes = fs.readFileSync(path.join(testDocsDir, `${docId}.enc`));
assert(!docDiskBytes.toString('latin1').includes('Sensitive Personal Identification Data'), 'FAIL: Document plaintext found on disk!');

// Retrieve and decrypt
const retrieved = await docStorage.retrieveEncryptedDocument(docId, keyBuffer);
assert.strictEqual(retrieved.originalName, 'Property_Sale_Deed.pdf');
assert.strictEqual(retrieved.mimeType, 'application/pdf');
assert(retrieved.content.equals(syntheticPdfContent), 'Decrypted document must match original binary content bit-for-bit');

// Tamper verification (flip 1 byte in ciphertext)
const tamperedBytes = Buffer.from(docDiskBytes);
tamperedBytes[tamperedBytes.length - 5] ^= 0xff; // corrupt a ciphertext byte
fs.writeFileSync(path.join(testDocsDir, `${docId}.enc`), tamperedBytes);

let tamperCaught = false;
try {
  await docStorage.retrieveEncryptedDocument(docId, keyBuffer);
} catch {
  tamperCaught = true;
}
assert(tamperCaught, 'FAIL: Tampered ciphertext must fail GCM authentication check');

// Restore original document for backup test
await docStorage.storeEncryptedDocument(
  docId,
  'Property_Sale_Deed.pdf',
  syntheticPdfContent,
  keyBuffer,
  'application/pdf'
);
console.log('  [PASS] Document encryption, bit-for-bit recovery, and tamper rejection verified.\n');

// -----------------------------------------------------------------------------
// Test 9: Vault Backup and Restore Manager
// -----------------------------------------------------------------------------
console.log('[TEST 9] Testing vault backup and restore manager...');
const backupManager = new VaultBackupRestoreManager(testDbPath, testDocsDir, testBackupsDir);
const backupArchivePath = path.join(testBackupsDir, 'test_vault_backup.fvault');

const backupManifest = await backupManager.createBackup(
  backupArchivePath,
  keyBuffer,
  'CustomBackupPassphrase!789'
);

assert.strictEqual(backupManifest.manifestVersion, 1);
assert.strictEqual(backupManifest.documentsCount, 1);
assert.strictEqual(backupManifest.encryptedWithCustomPassphrase, true);
assert(fs.existsSync(backupArchivePath), 'Backup archive file must be created');

// Verify backup archive integrity
const verifiedManifest = await backupManager.verifyBackupArchive(
  backupArchivePath,
  'CustomBackupPassphrase!789'
);
assert.strictEqual(verifiedManifest.databaseSha256, backupManifest.databaseSha256);

// Restore into isolated directory
const restoreDir = path.join(TEST_DIR, 'restored_vault');
const restoreReport = await backupManager.restoreBackup(
  backupArchivePath,
  'CustomBackupPassphrase!789',
  restoreDir
);

assert(restoreReport.success, 'Restore must report success');
assert(fs.existsSync(path.join(restoreDir, 'familyvault.db')), 'Restored database must exist');
assert(fs.existsSync(path.join(restoreDir, 'attachments', `${docId}.enc`)), 'Restored attachment must exist');

// Verify restored database can be opened and decrypted with the key
const restoredDb = openEncryptedDatabase(path.join(restoreDir, 'familyvault.db'), keyHex);
assert(restoredDb.verifyConnection(), 'Restored database must decrypt cleanly');
const restoredMember = restoredDb.prepare("SELECT * FROM family_members WHERE member_id = 'mem_sec_1'").get();
assert.strictEqual(restoredMember?.member_name, sensitiveUserName);
restoredDb.close();

console.log('  [PASS] Backup creation, verification, and full restoration verified.\n');

// -----------------------------------------------------------------------------
// Test 10: API Security Controls (Loopback, Origin, and Host Validation)
// -----------------------------------------------------------------------------
console.log('[TEST 10] Testing API security controls (loopback & origin checks)...');

// Valid loopback requests
const loopbackIpv4 = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5173' } };
const loopbackIpv6 = { socket: { remoteAddress: '::1' }, headers: { host: '127.0.0.1:5173' } };
const loopbackMapped = { socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: { host: 'localhost:5173' } };

assert(isLoopbackRequest(loopbackIpv4), '127.0.0.1 must be accepted');
assert(isLoopbackRequest(loopbackIpv6), '::1 must be accepted');
assert(isLoopbackRequest(loopbackMapped), '::ffff:127.0.0.1 must be accepted');

// External / non-loopback IPs
const externalLan = { socket: { remoteAddress: '192.168.1.100' }, headers: { host: 'localhost:5173' } };
const externalWan = { socket: { remoteAddress: '8.8.8.8' }, headers: { host: 'localhost:5173' } };

assert(!isLoopbackRequest(externalLan), '192.168.x.x must be rejected');
assert(!isLoopbackRequest(externalWan), 'External WAN IP must be rejected');

// Valid Origin and Host
const validHostOrigin = {
  headers: {
    host: 'localhost:5173',
    origin: 'http://localhost:5173'
  }
};
assert(isValidOriginAndHost(validHostOrigin), 'localhost host and origin must be accepted');

// Malicious external origins / DNS rebinding attempts
const invalidHost = { headers: { host: 'attacker-site.com', origin: 'http://localhost:5173' } };
const invalidOrigin = { headers: { host: 'localhost:5173', origin: 'http://malicious-site.com' } };

assert(!isValidOriginAndHost(invalidHost), 'External Host must be rejected');
assert(!isValidOriginAndHost(invalidOrigin), 'External Origin must be rejected');

console.log('  [PASS] Confirmed API loopback restrictions, DNS rebinding guards, and origin validation.\n');

// -----------------------------------------------------------------------------
// Test 11: Storage Engine Lifecycle (initialize, lock, unlock)
// -----------------------------------------------------------------------------
console.log('[TEST 11] Testing SqliteStorageEngine full lifecycle...');
const engineTestDir = path.join(TEST_DIR, 'engine_test');
const engineDbPath = path.join(engineTestDir, 'familyvault.db');
const engine = new SqliteStorageEngine();

// 1. Initialize
const initRes = await engine.initialize(masterPassphrase, engineDbPath);
assert(engine.isUnlocked(), 'Engine must be unlocked after initialization');
assert(initRes.db.isOpen(), 'Database must be open');

// 2. Lock
engine.lock();
assert(!engine.isUnlocked(), 'Engine must be locked after lock()');
assert.strictEqual(engine.getDb(), null, 'Database handle must be null after lock');

// 3. Unlock with correct password
const unlockRes = await engine.unlock(masterPassphrase, engineDbPath);
assert(engine.isUnlocked(), 'Engine must be unlocked after unlock()');
assert(unlockRes.db.verifyConnection(), 'Connection must be verified');

// 4. Lock again
engine.lock();

// 5. Unlock with wrong password must throw
let wrongUnlockBlocked = false;
try {
  await engine.unlock('CompletelyWrongPassword123!', engineDbPath);
} catch {
  wrongUnlockBlocked = true;
}
assert(wrongUnlockBlocked, 'Unlock with wrong password must throw');
assert(!engine.isUnlocked(), 'Engine must remain locked on failed unlock attempt');

console.log('  [PASS] Storage engine lifecycle (initialize, lock, unlock, wrong password block) verified.\n');

// -----------------------------------------------------------------------------
// Cleanup temporary test directory
// -----------------------------------------------------------------------------
try {
  fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
} catch {
  // Ignore Windows handle release delay on cleanup
}

console.log('================================================================');
console.log('  ALL ENCRYPTED STORAGE FOUNDATION TESTS PASSED (11/11)!        ');
console.log('================================================================\n');
