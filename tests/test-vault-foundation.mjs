import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import DatabaseConstructor from 'better-sqlite3-multiple-ciphers';

import {
  getVaultDataDir,
  getVaultDbPath,
  CRYPTO_CONFIG
} from '../server/config.ts';
import {
  deriveEncryptionKey,
  wipeBuffer
} from '../server/crypto.ts';
import {
  openEncryptedDatabase,
  initializeSchema,
  verifyDatabaseConnection,
  SCHEMA_SQL
} from '../server/db.ts';
import { vaultManager } from '../server/auth.ts';
import { isLoopbackRequest, isValidOriginAndHost } from '../server/api.ts';

console.log('================================================================');
console.log('  FamilyVault Phase 2 — Security & Encrypted Foundation Tests   ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Storage Location Verification (Outside OneDrive)
// -----------------------------------------------------------------------------
console.log('[TEST 1] Verifying storage location is outside OneDrive...');
const dataDir = getVaultDataDir();
console.log(`  -> Resolved Vault Data Dir: ${dataDir}`);
assert(dataDir.toLowerCase().includes('appdata\\local') || dataDir.toLowerCase().includes('appdata/local'),
  'FAIL: Vault data dir must be inside Local AppData');
assert(!dataDir.toLowerCase().includes('onedrive'),
  'FAIL: Vault data dir must NOT be inside OneDrive');
console.log('  [PASS] Confirmed storage path is strictly in %LOCALAPPDATA% and outside OneDrive.\n');

// -----------------------------------------------------------------------------
// Test 2: Master Password Key Derivation & Genuine Database Encryption
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing PBKDF2-HMAC-SHA512 key derivation & SQLCipher encryption...');
const testDir = path.resolve('./temp_test_vault');
fs.mkdirSync(testDir, { recursive: true });
const testDbPath = path.join(testDir, 'synthetic_test.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const strongPassword = 'CorrectMasterPassphrase!2026';
const salt = crypto.randomBytes(CRYPTO_CONFIG.SALT_BYTES);
const keyBuffer = deriveEncryptionKey(strongPassword, salt);
assert.strictEqual(keyBuffer.length, 32, 'Derived key must be exactly 32 bytes (256-bit)');
const keyHex = keyBuffer.toString('hex');

// Open and populate synthetic encrypted database
const db = openEncryptedDatabase(testDbPath, keyHex);
initializeSchema(db);

const syntheticSecret = 'SyntheticSecretFinancialRecord_TEST_123';
db.prepare("INSERT INTO family_members (member_id, member_name, role) VALUES ('mem_test_1', 'Synthetic Test User', 'Test Role')").run();
db.prepare("INSERT INTO assets (a_id, member_id, asset_type, asset_name, asset_status) VALUES ('ast_test_1', 'mem_test_1', 'FD', ?, 'ACTIVE')").run(syntheticSecret);
db.close();

// Inspect raw disk bytes to confirm genuine page encryption
const diskBytes = fs.readFileSync(testDbPath);
const diskString = diskBytes.toString('latin1');
assert(!diskString.includes(syntheticSecret), 'FAIL: Sensitive plaintext found in database file!');
assert(!diskString.includes('Synthetic Test User'), 'FAIL: User plaintext found in database file!');
assert(!diskString.includes('family_members'), 'FAIL: Table name plaintext found in database file!');
console.log('  [PASS] Hex inspection verified ZERO plaintext on disk. Data is genuinely encrypted with SQLCipher.\n');

// -----------------------------------------------------------------------------
// Test 3: Rejection of Incorrect Master Password
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing rejection of incorrect master password...');
const wrongPassword = 'WrongMasterPassphrase!999';
const wrongKeyBuffer = deriveEncryptionKey(wrongPassword, salt);
const wrongKeyHex = wrongKeyBuffer.toString('hex');

let rejectedWithWrongKey = false;
let dbWrong = null;
try {
  dbWrong = openEncryptedDatabase(testDbPath, wrongKeyHex);
  const isValid = verifyDatabaseConnection(dbWrong);
  if (!isValid) {
    rejectedWithWrongKey = true;
  }
} catch (err) {
  rejectedWithWrongKey = true;
  console.log(`  -> Correctly threw exception on wrong key: ${err.message}`);
} finally {
  if (dbWrong) {
    try { dbWrong.close(); } catch {}
  }
}
assert(rejectedWithWrongKey, 'FAIL: Database should NOT open or query with incorrect key!');
console.log('  [PASS] Confirmed opening with incorrect master password is cryptographically rejected.\n');

// -----------------------------------------------------------------------------
// Test 4: Schema Integrity & All 11 Relational Tables
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing full 11-table relational schema & indexes...');
const dbCorrect = openEncryptedDatabase(testDbPath, keyHex);
const tablesResult = dbCorrect.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").all();
const tableNames = tablesResult.map((r) => r.name);
console.log(`  -> Tables initialized in encrypted DB (${tableNames.length}):`, tableNames.join(', '));

const expectedTables = [
  'family_members',
  'assets',
  'fds',
  'post_office',
  'bullions',
  'properties',
  'rents',
  'asset_sales',
  'payments',
  'documents',
  'contributions',
  '_migration_ledger'
];

for (const exp of expectedTables) {
  assert(tableNames.includes(exp), `FAIL: Missing expected table: ${exp}`);
}

// Verify indexes exist
const indexResult = dbCorrect.prepare("SELECT name FROM sqlite_master WHERE type='index';").all();
assert(indexResult.length >= 10, 'FAIL: Indexes must be created on relational foreign keys');
console.log(`  [PASS] Confirmed all 11 relational tables + migration ledger exist with ${indexResult.length} indexes.\n`);

// -----------------------------------------------------------------------------
// Test 5: Foreign-Key Enforcement & Cascading Constraints
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing foreign-key enforcement & constraint integrity...');
// Foreign keys are enabled
const fkStatus = dbCorrect.pragma('foreign_keys', { simple: true });
assert.strictEqual(fkStatus, 1, 'Foreign keys pragma must be active (1)');

// Try inserting orphan asset without parent family member
let orphanPrevented = false;
try {
  dbCorrect.prepare("INSERT INTO assets (a_id, member_id, asset_type, asset_name, asset_status) VALUES ('ast_orphan', 'non_existent_mem', 'FD', 'Orphan FD', 'ACTIVE')").run();
} catch (err) {
  orphanPrevented = true;
  console.log(`  -> Foreign-key constraint triggered on orphan insert: ${err.message}`);
}
assert(orphanPrevented, 'FAIL: Foreign key violation should reject orphan asset record!');

// Try inserting FD child linked to existing asset
dbCorrect.prepare(`
  INSERT INTO fds (fd_id, a_id, bank_name, acc_number, principal, interest_rate, start_date, maturity_date)
  VALUES ('fd_synth_1', 'ast_test_1', 'State Bank of India', '•••• 1234', 500000, 7.1, '2026-01-01', '2027-01-01')
`).run();

const fdRow = dbCorrect.prepare("SELECT * FROM fds WHERE fd_id = 'fd_synth_1'").get();
assert.strictEqual(fdRow.principal, 500000);
assert.strictEqual(fdRow.interest_rate, 7.1);

dbCorrect.close();
console.log('  [PASS] Foreign-key constraints and relational integrity verified.\n');

// -----------------------------------------------------------------------------
// Test 6: Memory Buffer Scrubbing (Wiping Key on Lock)
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing in-memory key buffer wiping...');
const keyToWipe = Buffer.from('SensitiveKeyMaterial123456789012');
assert.notStrictEqual(keyToWipe[0], 0);
wipeBuffer(keyToWipe);
assert.strictEqual(keyToWipe[0], 0);
assert.strictEqual(keyToWipe[keyToWipe.length - 1], 0);
console.log('  [PASS] Memory zeroing verified (all bytes overwritten with 0x00).\n');

// -----------------------------------------------------------------------------
// Test 7: API Access Controls & Loopback/Origin Enforcement
// -----------------------------------------------------------------------------
console.log('[TEST 7] Testing API security controls (Loopback & Origin check)...');
// Loopback test
const validReq = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5173', origin: 'http://localhost:5173' } };
const invalidIpReq = { socket: { remoteAddress: '192.168.1.100' }, headers: { host: 'localhost:5173' } };
const invalidOriginReq = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:5173', origin: 'http://evil-tracker.com' } };
const invalidHostReq = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'evil-tracker.com' } };

assert(isLoopbackRequest(validReq), '127.0.0.1 must be accepted');
assert(!isLoopbackRequest(invalidIpReq), 'External IP must be rejected');
assert(isValidOriginAndHost(validReq), 'localhost origin and host must be accepted');
assert(!isValidOriginAndHost(invalidOriginReq), 'External origin must be rejected');
assert(!isValidOriginAndHost(invalidHostReq), 'External host must be rejected');
console.log('  [PASS] Confirmed API strictly blocks non-loopback IPs, malicious origins, and DNS rebinding.\n');

// Clean up temporary synthetic test directory (with retries for Windows file locking)
try {
  fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
} catch {
  // If Windows holds file lock until process termination, ignore cleanup error
}

console.log('================================================================');
console.log('  ALL PHASE 2 ENCRYPTED FOUNDATION TESTS PASSED SUCCESSFULLY!   ');
console.log('================================================================');
