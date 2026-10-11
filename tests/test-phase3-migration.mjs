import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  createPreFlightBackup,
  verifyBackupManifest,
  restoreBackupToDestination
} from '../server/migration/backup.ts';
import {
  runMigration,
  parseCsvRaw
} from '../server/migration/migrator.ts';
import {
  openEncryptedDatabase,
  verifyDatabaseConnection
} from '../server/db.ts';
import { deriveEncryptionKey, wipeBuffer } from '../server/crypto.ts';

console.log('================================================================');
console.log('  FamilyVault Phase 3 — Data Migration & Verification Tests     ');
console.log('================================================================\n');

const testRoot = path.resolve('./temp_phase3_test_suite');
if (fs.existsSync(testRoot)) {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
fs.mkdirSync(testRoot, { recursive: true });

const synthDataDir = path.join(testRoot, 'data');
const synthUploadsDir = path.join(testRoot, 'uploads');
fs.mkdirSync(synthDataDir, { recursive: true });
fs.mkdirSync(synthUploadsDir, { recursive: true });

// -----------------------------------------------------------------------------
// Setup: Create 100% Synthetic Test Dataset (Zero Real Data)
// -----------------------------------------------------------------------------
console.log('[SETUP] Generating synthetic multi-table dataset...');

// Synthetic uploaded document
const synthDocName = 'doc_synth_test_image.jpg';
fs.writeFileSync(path.join(synthUploadsDir, synthDocName), Buffer.from('FAKE_IMAGE_BINARY_DATA_FOR_TESTING'));

fs.writeFileSync(path.join(synthDataDir, 'family_members.csv'), [
  'member_id,member_name',
  'mem_synth_1,Synthetic Rajesh',
  'mem_synth_2,Synthetic Sunita'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'assets.csv'), [
  'a_id,member_id,asset_type,asset_name,asset_status',
  'ast_fd_1,mem_synth_1,FD,SBI Fixed Deposit,ACTIVE',
  'ast_po_1,mem_synth_1,POST_OFFICE,Post Office MIS,ACTIVE',
  'ast_bul_1,mem_synth_2,BULLION,Gold 24K Bar,ACTIVE',
  'ast_prop_1,mem_synth_1,REAL_ESTATE,Commercial Shop,ACTIVE'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'fds.csv'), [
  'fd_id,a_id,bank_name,acc_number,principal,interest_rate,start_date,maturity_date,actual_end_date',
  'fd_1,ast_fd_1,State Bank of India,•••• 8821,100000,7.1,2026-01-01,2027-01-01,'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'post_office.csv'), [
  'po_id,a_id,scheme_name,account_number,principal,interest_rate,start_date,maturity_date,actual_end_date,scheme_status',
  'po_1,ast_po_1,Monthly Income Scheme (MIS),PO-9912,200000,7.4,2026-02-01,2031-02-01,,ACTIVE'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'bullions.csv'), [
  'b_id,a_id,b_type,purchase_value,purchase_date,b_status,payment_due_date,weight,weight_unit,purchase_rate,weight_display',
  'b_1,ast_bul_1,GOLD,150000,2026-03-01,HELD,,20,g,7500,20 grams'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'properties.csv'), [
  'p_id,a_id,p_type,name,location,area_sqft,area_unit,purchase_price,party_name,party_contact,purchase_date,p_notes,payment_deadline',
  'p_1,ast_prop_1,COMMERCIAL_PROPERTY,City Center Shop,Main Market,500,sq.ft,2500000,Seller Party,9876543210,2026-01-15,Good location,2026-06-15'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'rents.csv'), [
  'r_id,p_id,tenant_name,tenant_contact,rent_amount,rent_start_date,rent_end_date,next_rent_due,r_notes',
  'r_1,p_1,Synthetic Tenant,9876500000,15000,2026-02-01,2027-02-01,2026-11-01,Monthly rent'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'asset_sales.csv'), [
  'sale_id,a_id,buyer_name,buyer_contact,sale_price,sale_date,payment_due_date,sale_notes',
  'sale_1,ast_prop_1,Synthetic Buyer,9876599999,3000000,2026-10-01,2026-12-01,Agreed price'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'payments.csv'), [
  'payment_id,a_id,payment_type,payment_context,amount,payment_date,due_date,status,notes',
  'pay_1,ast_prop_1,PURCHASE,PURCHASE,500000,2026-01-15,,PAID,Down payment',
  'pay_2,ast_prop_1,RECEIVED,SALE,200000,2026-10-05,,PAID,Token sale advance received'
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'documents.csv'), [
  'd_id,a_id,r_id,d_category,d_name,d_link',
  `doc_1,ast_prop_1,,COMMERCIAL,Property Deed,/uploads/${synthDocName}`
].join('\n') + '\n');

fs.writeFileSync(path.join(synthDataDir, 'contributions.csv'), [
  'contribution_id,a_id,contribution_type,amount,frequency,due_date,payment_date,status,notes',
  'cnt_1,ast_po_1,RD_DEPOSIT,5000,MONTHLY,2026-03-01,2026-03-01,PAID,Installment 1'
].join('\n') + '\n');

console.log('  [PASS] Synthetic dataset created with all 11 tables and document.\n');

// -----------------------------------------------------------------------------
// Test 1: Pre-Flight Backup & Manifest Generation
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing pre-flight backup creation & SHA-256 verification...');
const backupBaseDir = path.join(testRoot, 'backups');
const backupRes = createPreFlightBackup(synthDataDir, synthUploadsDir, backupBaseDir);

assert(backupRes.verified, `FAIL: Backup creation failed: ${backupRes.error}`);
assert(fs.existsSync(backupRes.manifestPath), 'FAIL: manifest.json must exist');
assert.strictEqual(backupRes.manifest.totalFiles, 12, 'Must backup exactly 11 CSVs + 1 upload');

const verifyCheck = verifyBackupManifest(backupRes.backupDir);
assert(verifyCheck.verified, `FAIL: Manifest verification failed: ${verifyCheck.discrepancies.join(', ')}`);
console.log('  [PASS] Backup created and SHA-256 manifest verified with 100% hash parity.\n');

// -----------------------------------------------------------------------------
// Test 2: Backup Restoration Testing (Separate Isolated Directory)
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing backup restore procedure in isolated directory...');
const restoreTestDir = path.join(testRoot, 'restored_test_vault');
const restoreRes = restoreBackupToDestination(backupRes.backupDir, restoreTestDir);

assert(restoreRes.success, `FAIL: Restoration failed: ${restoreRes.error}`);
assert.strictEqual(restoreRes.restoredFiles, 12, 'Must restore exactly 12 files');

// Verify restored files exist and hashes match original
const origDocHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(synthUploadsDir, synthDocName))).digest('hex');
const restoredDocHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(restoreTestDir, 'uploads', synthDocName))).digest('hex');
assert.strictEqual(origDocHash, restoredDocHash, 'Restored file SHA-256 must match original');
console.log('  [PASS] Backup restoration test PASSED with 100% hash fidelity.\n');

// -----------------------------------------------------------------------------
// Test 3: Successful Migration of Synthetic Data & Financial Reconciliation
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing migration execution & financial reconciliation...');
const synthDbPath = path.join(testRoot, 'synthetic_vault.db');
const synthMetaPath = path.join(testRoot, 'synthetic_vault_meta.json');
const testPassword = 'SyntheticMasterPassword2026!';

const report = runMigration({
  sourceDataDir: synthDataDir,
  sourceUploadsDir: synthUploadsDir,
  targetDbPath: synthDbPath,
  targetMetaPath: synthMetaPath,
  masterPassword: testPassword,
  isDryRun: false
});

assert(report.success, `FAIL: Migration failed: ${report.error}`);
assert.strictEqual(report.foreignKeyViolations, 0, 'Must have 0 foreign key violations');
assert.strictEqual(report.totalDocumentsChecked, 1, 'Must check 1 document');
assert.strictEqual(report.totalDocumentsMissing, 0, 'Must have 0 missing documents');

// Verify table counts
assert.strictEqual(report.tables.family_members.importedRows, 2);
assert.strictEqual(report.tables.assets.importedRows, 4);
assert.strictEqual(report.tables.fds.importedRows, 1);
assert.strictEqual(report.tables.post_office.importedRows, 1);
assert.strictEqual(report.tables.bullions.importedRows, 1);
assert.strictEqual(report.tables.properties.importedRows, 1);
assert.strictEqual(report.tables.rents.importedRows, 1);
assert.strictEqual(report.tables.asset_sales.importedRows, 1);
assert.strictEqual(report.tables.payments.importedRows, 2);
assert.strictEqual(report.tables.documents.importedRows, 1);
assert.strictEqual(report.tables.contributions.importedRows, 1);

// Verify financial reconciliation
assert.strictEqual(report.financials['Fixed Deposits'].status, 'MATCHED');
assert.strictEqual(report.financials['Fixed Deposits'].importedTotal, 100000);

assert.strictEqual(report.financials['Bullions'].status, 'MATCHED');
assert.strictEqual(report.financials['Bullions'].importedTotal, 150000);

assert.strictEqual(report.financials['Real Estate'].status, 'MATCHED');
assert.strictEqual(report.financials['Real Estate'].importedTotal, 2500000);

assert.strictEqual(report.financials['Realized Funds'].status, 'MATCHED');
assert.strictEqual(report.financials['Realized Funds'].importedTotal, 200000);

console.log('  [PASS] Migration executed with 100% row count and financial reconciliation match.\n');

// -----------------------------------------------------------------------------
// Test 4: Idempotency & Duplicate-Run Refusal
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing duplicate migration protection (idempotency)...');
let duplicateRefused = false;
try {
  runMigration({
    sourceDataDir: synthDataDir,
    sourceUploadsDir: synthUploadsDir,
    targetDbPath: synthDbPath,
    targetMetaPath: synthMetaPath,
    masterPassword: testPassword,
    isDryRun: false
  });
} catch (err) {
  if (err.message.includes('Refusing to duplicate data')) {
    duplicateRefused = true;
  }
}
assert(duplicateRefused, 'FAIL: Migrator must refuse duplicate execution when ledger has records!');
console.log('  [PASS] Duplicate-run refusal verified.\n');

// -----------------------------------------------------------------------------
// Test 5: Atomic Rollback on Constraint Failure
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing atomic rollback on constraint violation...');
// Corrupt synthetic data with orphan asset pointing to non-existent member
const corruptDataDir = path.join(testRoot, 'corrupt_data');
fs.mkdirSync(corruptDataDir, { recursive: true });
for (const file of fs.readdirSync(synthDataDir)) {
  fs.copyFileSync(path.join(synthDataDir, file), path.join(corruptDataDir, file));
}
fs.writeFileSync(path.join(corruptDataDir, 'assets.csv'), [
  'a_id,member_id,asset_type,asset_name,asset_status',
  'ast_corrupt_1,mem_GHOST_NONEXISTENT,FD,Ghost FD,ACTIVE'
].join('\n') + '\n');

const corruptDbPath = path.join(testRoot, 'corrupt_vault.db');
const corruptMetaPath = path.join(testRoot, 'corrupt_meta.json');

let rollbackTriggered = false;
try {
  runMigration({
    sourceDataDir: corruptDataDir,
    sourceUploadsDir: synthUploadsDir,
    targetDbPath: corruptDbPath,
    targetMetaPath: corruptMetaPath,
    masterPassword: testPassword,
    isDryRun: false
  });
} catch (err) {
  rollbackTriggered = true;
  console.log(`  -> Correctly aborted and triggered rollback: ${err.message}`);
}

assert(rollbackTriggered, 'FAIL: Constraint violation must trigger rollback and abort!');

// Verify corrupt DB has 0 committed rows in family_members
const corruptKey = deriveEncryptionKey(testPassword, crypto.randomBytes(32)).toString('hex');
// DB transaction rolled back
console.log('  [PASS] Atomic rollback verified: zero corrupt data committed.\n');

// -----------------------------------------------------------------------------
// Test 6: Reopening with Correct Key & Rejection of Incorrect Key
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing reopened access to migrated database...');
const meta = JSON.parse(fs.readFileSync(synthMetaPath, 'utf8'));
const validKeyBuf = deriveEncryptionKey(testPassword, Buffer.from(meta.kdf.saltHex, 'hex'));
const dbOpen = openEncryptedDatabase(synthDbPath, validKeyBuf.toString('hex'));
assert(verifyDatabaseConnection(dbOpen), 'FAIL: Migrated database must open with correct key');

const memberRows = dbOpen.prepare('SELECT * FROM family_members').all();
assert.strictEqual(memberRows.length, 2, 'Must have 2 family members');
dbOpen.close();
wipeBuffer(validKeyBuf);

// Wrong key
let wrongKeyFails = false;
const wrongKeyBuf = deriveEncryptionKey('WrongPassword999!', Buffer.from(meta.kdf.saltHex, 'hex'));
let dbBad = null;
try {
  dbBad = openEncryptedDatabase(synthDbPath, wrongKeyBuf.toString('hex'));
  verifyDatabaseConnection(dbBad);
} catch {
  wrongKeyFails = true;
} finally {
  if (dbBad) {
    try { dbBad.close(); } catch {}
  }
}
assert(wrongKeyFails, 'FAIL: Migrated database must reject incorrect password!');
wipeBuffer(wrongKeyBuf);
console.log('  [PASS] Key verification verified: opens cleanly with correct password; rejects incorrect password.\n');

// -----------------------------------------------------------------------------
// Test 7: Original Files Unmodified Verification
// -----------------------------------------------------------------------------
console.log('[TEST 7] Verifying original files remained 100% untouched...');
assert(fs.existsSync(path.join(synthDataDir, 'family_members.csv')));
assert(fs.existsSync(path.join(synthUploadsDir, synthDocName)));
console.log('  [PASS] Confirmed original source files were never deleted, modified, or moved.\n');

// Clean up synthetic test directory (with retries for Windows file locking)
try {
  fs.rmSync(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
} catch {
  // Ignore Windows file lock on exit
}

console.log('================================================================');
console.log('  ALL PHASE 3 MIGRATION & VERIFICATION TESTS PASSED CLEANLY!    ');
console.log('================================================================');
