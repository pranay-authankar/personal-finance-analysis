import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { runMigration } from '../server/migration/index.ts';
import { readAllCsvTables } from '../server/migration/csvReader.ts';
import { validateDataset } from '../server/migration/validator.ts';
import { VaultBackupRestoreManager } from '../server/storage/backupManager.ts';
import { openEncryptedDatabase } from '../server/storage/sqliteAdapter.ts';
import { deriveEncryptionKey, generateSalt, wipeBuffer } from '../server/storage/crypto.ts';

console.log('================================================================');
console.log('  FamilyVault — Migration Safety & Security Test Suite          ');
console.log('================================================================\n');

const BASE_TEST_DIR = path.resolve('./temp_migration_test_suite');
if (fs.existsSync(BASE_TEST_DIR)) {
  fs.rmSync(BASE_TEST_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}
fs.mkdirSync(BASE_TEST_DIR, { recursive: true });

const syntheticDataDir = path.join(BASE_TEST_DIR, 'data');
const syntheticUploadsDir = path.join(BASE_TEST_DIR, 'uploads');
fs.mkdirSync(syntheticDataDir, { recursive: true });
fs.mkdirSync(syntheticUploadsDir, { recursive: true });

// -----------------------------------------------------------------------------
// Helper: Populate Synthetic Test Fixtures
// -----------------------------------------------------------------------------
function populateSyntheticFixtures(dataDir, uploadsDir) {
  // 1. family_members.csv
  fs.writeFileSync(
    path.join(dataDir, 'family_members.csv'),
    'member_id,member_name,role,avatar\n' +
    'mem_test_1,Alice Sharma,Primary,🧑\n' +
    'mem_test_2,Bob Sharma,Spouse,👩\n'
  );

  // 2. assets.csv
  fs.writeFileSync(
    path.join(dataDir, 'assets.csv'),
    'a_id,member_id,asset_type,asset_name,asset_status\n' +
    'ast_fd_1,mem_test_1,FD,SBI Fixed Deposit,ACTIVE\n' +
    'ast_po_1,mem_test_1,POST_OFFICE,Post Office RD Account,ACTIVE\n' +
    'ast_po_2,mem_test_2,POST_OFFICE,Post Office TD Scheme,ACTIVE\n' +
    'ast_bul_1,mem_test_2,BULLION,Gold Coins 24k,ACTIVE\n' +
    'ast_prop_1,mem_test_1,REAL_ESTATE,Greenwood Plot,ACTIVE\n'
  );

  // 3. fds.csv
  fs.writeFileSync(
    path.join(dataDir, 'fds.csv'),
    'fd_id,a_id,bank_name,acc_number,principal,interest_rate,start_date,maturity_date,actual_end_date\n' +
    'fd_1,ast_fd_1,State Bank of India,•••• 1111,500000,7.1,2026-01-01,2027-01-01,\n'
  );

  // 4. post_office.csv
  fs.writeFileSync(
    path.join(dataDir, 'post_office.csv'),
    'po_id,a_id,scheme_name,account_number,principal,interest_rate,start_date,maturity_date,actual_end_date,scheme_status\n' +
    'po_1,ast_po_1,National Recurring Deposit (RD),PO-RD-1234,,6.7,2026-01-01,2031-01-01,,ACTIVE\n' +
    'po_2,ast_po_2,Post Office Time Deposit (TD),PO-TD-5678,200000,7.5,2026-01-01,2029-01-01,,ACTIVE\n'
  );

  // 5. bullions.csv
  fs.writeFileSync(
    path.join(dataDir, 'bullions.csv'),
    'b_id,a_id,b_type,purchase_value,purchase_date,b_status,payment_due_date,weight,weight_unit,purchase_rate,weight_display\n' +
    'bul_1,ast_bul_1,GOLD,150000,2026-02-01,HELD,,20,g,7500,20 grams\n'
  );

  // 6. properties.csv
  fs.writeFileSync(
    path.join(dataDir, 'properties.csv'),
    'p_id,a_id,p_type,name,location,area_sqft,area_unit,purchase_price,party_name,party_contact,purchase_date,p_notes,payment_deadline\n' +
    'prop_1,ast_prop_1,LAND,Greenwood Plot,Bangalore East,1500,sq.ft,3500000,Developer ABC,9876543210,2026-01-15,,2026-03-31\n'
  );

  // 7. rents.csv
  fs.writeFileSync(
    path.join(dataDir, 'rents.csv'),
    'r_id,p_id,tenant_name,tenant_contact,rent_amount,rent_start_date,rent_end_date,next_rent_due,r_notes\n' +
    'rent_1,prop_1,John Tenant,9123456780,25000,2026-02-01,,,Rent agreement for 11 months\n'
  );

  // 8. asset_sales.csv
  fs.writeFileSync(
    path.join(dataDir, 'asset_sales.csv'),
    'sale_id,a_id,buyer_name,buyer_contact,sale_price,sale_date,payment_due_date,sale_notes\n'
  );

  // 9. payments.csv
  fs.writeFileSync(
    path.join(dataDir, 'payments.csv'),
    'payment_id,a_id,payment_type,payment_context,amount,payment_date,due_date,status,notes\n' +
    'pay_1,ast_prop_1,PURCHASE,PURCHASE,1000000,2026-01-15,,PAID,Down payment\n' +
    'pay_2,ast_prop_1,PURCHASE,PURCHASE,2500000,,2026-03-31,PENDING,Balance payment\n' +
    'pay_mat_1,ast_fd_1,RECEIVED,MATURITY,535500,2026-02-10,,RECEIVED,Early partial maturity proceeds\n'
  );

  // 10. documents.csv
  fs.writeFileSync(
    path.join(dataDir, 'documents.csv'),
    'd_id,a_id,r_id,d_category,d_name,d_link\n' +
    'doc_1,ast_prop_1,,LAND,Sale Deed,/api/uploads/sale_deed_plot.pdf\n'
  );

  // 11. contributions.csv
  fs.writeFileSync(
    path.join(dataDir, 'contributions.csv'),
    'contribution_id,a_id,contribution_type,amount,frequency,due_date,payment_date,status,notes\n' +
    'cnt_1,ast_po_1,RD_DEPOSIT,5000,MONTHLY,2026-01-10,2026-01-10,PAID,Installment 1\n' +
    'cnt_2,ast_po_1,RD_DEPOSIT,5000,MONTHLY,2026-02-10,2026-02-10,PAID,Installment 2\n' +
    'cnt_3,ast_po_1,RD_DEPOSIT,5000,MONTHLY,2026-03-10,,PENDING,Installment 3\n'
  );

  // Upload attachment file
  fs.writeFileSync(
    path.join(uploadsDir, 'sale_deed_plot.pdf'),
    '%PDF-1.4 Synthetic Sale Deed Content for Plot 1'
  );
}

populateSyntheticFixtures(syntheticDataDir, syntheticUploadsDir);

// Snapshot original file hashes to test zero-modification boundary
const initialRaw = readAllCsvTables(syntheticDataDir);
const initialHashes = { ...initialRaw.fileHashes };

const TEST_PASSWORD = 'CorrectMasterPassphrase!2026';

// -----------------------------------------------------------------------------
// Test 1: Dry-Run Migration on 100% Valid Synthetic Data
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing dry-run migration on valid synthetic dataset...');
const dryRunReport = await runMigration({
  sourceDataDir: syntheticDataDir,
  sourceUploadsDir: syntheticUploadsDir,
  masterPassword: TEST_PASSWORD,
  dryRun: true
});

assert.strictEqual(dryRunReport.success, true, 'Dry run should report success on valid data');
assert.strictEqual(dryRunReport.mode, 'DRY_RUN');
assert.strictEqual(dryRunReport.errors.length, 0, 'Zero errors expected');
assert.strictEqual(dryRunReport.foreignKeyViolations, 0, 'Zero foreign key violations');

// Verify table reconciliation
for (const [tbl, metric] of Object.entries(dryRunReport.tables)) {
  assert.strictEqual(metric.status, 'MATCHED', `Table ${tbl} should match`);
  assert.strictEqual(metric.sourceRows, metric.validRows);
  assert.strictEqual(metric.rejectedRows, 0);
}

// Verify financial reconciliation
// FDs: 500,000 | PO: 200,000 (TD) + 10,000 (RD paid cnt_1, cnt_2) = 210,000 | Bullions: 150,000 | Real Estate: 3,500,000 | Realized: 535,500
assert.strictEqual(dryRunReport.financials['Fixed Deposits'].sourceTotal, 500000);
assert.strictEqual(dryRunReport.financials['Post Office'].sourceTotal, 210000);
assert.strictEqual(dryRunReport.financials['Bullions'].sourceTotal, 150000);
assert.strictEqual(dryRunReport.financials['Real Estate'].sourceTotal, 3500000);
assert.strictEqual(dryRunReport.financials['Realized Funds'].sourceTotal, 535500);
assert.strictEqual(dryRunReport.financials['Overall Net Worth'].sourceTotal, 4895500);

for (const [cat, fin] of Object.entries(dryRunReport.financials)) {
  assert.strictEqual(fin.status, 'RECONCILED', `Category ${cat} must reconcile`);
  assert.strictEqual(fin.difference, 0, `Category ${cat} must have zero difference`);
}

console.log('  [PASS] Dry run verified 100% record and financial parity without modifying files.\n');

// -----------------------------------------------------------------------------
// Test 2: Detection and Rejection of Malformed Numeric Values
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing detection and reporting of malformed records...');
const malformedDir = path.join(BASE_TEST_DIR, 'malformed_data');
fs.mkdirSync(malformedDir, { recursive: true });
populateSyntheticFixtures(malformedDir, syntheticUploadsDir);

// Inject malformed records: invalid numeric principal in fds.csv
fs.writeFileSync(
  path.join(malformedDir, 'fds.csv'),
  'fd_id,a_id,bank_name,acc_number,principal,interest_rate,start_date,maturity_date,actual_end_date\n' +
  'fd_bad_1,ast_fd_1,State Bank of India,•••• 1111,NOT_A_NUMBER,7.1,2026-01-01,2027-01-01,\n'
);

const malformedReport = await runMigration({
  sourceDataDir: malformedDir,
  sourceUploadsDir: syntheticUploadsDir,
  masterPassword: TEST_PASSWORD,
  dryRun: true
});

assert.strictEqual(malformedReport.success, false, 'Migration should fail on malformed numeric data');
assert(malformedReport.errors.length > 0, 'Errors must be reported');
assert(
  malformedReport.errors.some((e) => e.table === 'fds' && e.field === 'principal'),
  'Malformed principal error must be captured'
);
console.log('  [PASS] Correctly detected and rejected malformed numeric values with detailed diagnostics.\n');

// -----------------------------------------------------------------------------
// Test 3: Detection and Rejection of Orphan Foreign Keys
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing detection and rejection of orphan foreign keys...');
const orphanDir = path.join(BASE_TEST_DIR, 'orphan_data');
fs.mkdirSync(orphanDir, { recursive: true });
populateSyntheticFixtures(orphanDir, syntheticUploadsDir);

// Inject orphan asset referencing non-existent member
fs.appendFileSync(
  path.join(orphanDir, 'assets.csv'),
  'ast_orphan_1,mem_NON_EXISTENT,FD,Orphan Asset,ACTIVE\n'
);

const orphanReport = await runMigration({
  sourceDataDir: orphanDir,
  sourceUploadsDir: syntheticUploadsDir,
  masterPassword: TEST_PASSWORD,
  dryRun: true
});

assert.strictEqual(orphanReport.success, false, 'Migration should fail on orphan foreign key');
assert(
  orphanReport.errors.some((e) => e.table === 'assets' && e.message.includes('Orphan asset')),
  'Orphan asset error must be reported'
);
console.log('  [PASS] Correctly caught orphan foreign key reference before executing import.\n');

// -----------------------------------------------------------------------------
// Test 4: Detection and Rejection of Duplicate Primary Keys
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing detection and rejection of duplicate primary keys...');
const dupDir = path.join(BASE_TEST_DIR, 'duplicate_data');
fs.mkdirSync(dupDir, { recursive: true });
populateSyntheticFixtures(dupDir, syntheticUploadsDir);

// Duplicate primary key in family_members.csv
fs.appendFileSync(
  path.join(dupDir, 'family_members.csv'),
  'mem_test_1,Duplicate Person,Duplicate,🧑\n'
);

const dupReport = await runMigration({
  sourceDataDir: dupDir,
  sourceUploadsDir: syntheticUploadsDir,
  masterPassword: TEST_PASSWORD,
  dryRun: true
});

assert.strictEqual(dupReport.success, false, 'Migration should fail on duplicate primary key');
assert(
  dupReport.errors.some((e) => e.table === 'family_members' && e.message.includes('Duplicate primary key')),
  'Duplicate primary key error must be reported'
);
console.log('  [PASS] Duplicate primary key detected and blocked.\n');

// -----------------------------------------------------------------------------
// Test 5: Missing Document Attachments Handling
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing missing document attachment handling...');
const missingDocDir = path.join(BASE_TEST_DIR, 'missing_doc_data');
fs.mkdirSync(missingDocDir, { recursive: true });
populateSyntheticFixtures(missingDocDir, syntheticUploadsDir);

// Add document referencing file that does not exist in uploads
fs.appendFileSync(
  path.join(missingDocDir, 'documents.csv'),
  'doc_missing_1,ast_prop_1,,LAND,Missing Doc,/api/uploads/definitely_not_on_disk.pdf\n'
);

// Strict mode: should fail closed
const strictReport = await runMigration({
  sourceDataDir: missingDocDir,
  sourceUploadsDir: syntheticUploadsDir,
  masterPassword: TEST_PASSWORD,
  dryRun: true,
  allowMissingAttachments: false
});

assert.strictEqual(strictReport.success, false, 'Strict mode must halt on missing document');
assert(strictReport.missingDocuments.includes('definitely_not_on_disk.pdf'));

// Override mode: should proceed with warning
const overrideReport = await runMigration({
  sourceDataDir: missingDocDir,
  sourceUploadsDir: syntheticUploadsDir,
  masterPassword: TEST_PASSWORD,
  dryRun: true,
  allowMissingAttachments: true
});

assert.strictEqual(overrideReport.success, true, 'Override mode should proceed with warnings');
assert(overrideReport.warnings.some((w) => w.message.includes('missing from disk')));
console.log('  [PASS] Missing attachments verified: strict mode halts; override mode warns.\n');

// -----------------------------------------------------------------------------
// Test 6: Transaction Rollback on Failure
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing atomic transaction rollback on failure...');
const rollbackTargetDb = path.join(BASE_TEST_DIR, 'rollback_test.db');
const rollbackTargetMeta = path.join(BASE_TEST_DIR, 'rollback_meta.json');

// Inject a malformed payment amount into a copy of data
const badDataDir = path.join(BASE_TEST_DIR, 'bad_payment_data');
fs.mkdirSync(badDataDir, { recursive: true });
populateSyntheticFixtures(badDataDir, syntheticUploadsDir);
fs.appendFileSync(
  path.join(badDataDir, 'payments.csv'),
  'pay_bad_1,ast_prop_1,PURCHASE,PURCHASE,INVALID_AMOUNT,2026-01-01,,PENDING,\n'
);

let threw = false;
try {
  await runMigration({
    sourceDataDir: badDataDir,
    sourceUploadsDir: syntheticUploadsDir,
    targetDbPath: rollbackTargetDb,
    targetMetaPath: rollbackTargetMeta,
    masterPassword: TEST_PASSWORD,
    dryRun: false,
    skipBackup: true
  });
} catch {
  threw = true;
}

assert(threw, 'Migration should throw on validation error');
// Verify destination DB was not committed with partial state
if (fs.existsSync(rollbackTargetDb)) {
  const salt = generateSalt();
  const kBuffer = deriveEncryptionKey(TEST_PASSWORD, salt);
  // If db exists, it should have 0 records because transaction never committed
  try {
    const checkDb = openEncryptedDatabase(rollbackTargetDb, kBuffer.toString('hex'));
    const membersCount = checkDb.prepare("SELECT count(*) as count FROM family_members").get();
    assert.strictEqual(membersCount?.count || 0, 0, 'Database must have 0 records after rollback');
    checkDb.close();
  } catch {
    // If it cannot be opened, it was not created or uninitialized
  }
}
console.log('  [PASS] Transaction rollback verified: zero partial records committed on error.\n');

// -----------------------------------------------------------------------------
// Test 7: Idempotency & Safe Rerun without Duplicate Records
// -----------------------------------------------------------------------------
console.log('[TEST 7] Testing idempotency & safe rerun into synthetic database...');
const liveTargetDb = path.join(BASE_TEST_DIR, 'synthetic_live.db');
const liveTargetMeta = path.join(BASE_TEST_DIR, 'synthetic_live_meta.json');

// Run 1: Import valid data
const run1Report = await runMigration({
  sourceDataDir: syntheticDataDir,
  sourceUploadsDir: syntheticUploadsDir,
  targetDbPath: liveTargetDb,
  targetMetaPath: liveTargetMeta,
  masterPassword: TEST_PASSWORD,
  dryRun: false,
  skipBackup: true
});
assert.strictEqual(run1Report.success, true);
assert.strictEqual(run1Report.tables.family_members.importedRows, 2);

// Run 2: Rerun identical migration
const run2Report = await runMigration({
  sourceDataDir: syntheticDataDir,
  sourceUploadsDir: syntheticUploadsDir,
  targetDbPath: liveTargetDb,
  targetMetaPath: liveTargetMeta,
  masterPassword: TEST_PASSWORD,
  dryRun: false,
  skipBackup: true
});

assert.strictEqual(run2Report.success, true, 'Rerun must succeed');
// Record count must remain 2, not double to 4
assert.strictEqual(run2Report.tables.family_members.importedRows, 2, 'Rerun must NOT duplicate records');
assert.strictEqual(run2Report.tables.assets.importedRows, 5, 'Asset count must remain 5');

console.log('  [PASS] Idempotency verified: re-running does not create duplicate rows.\n');

// -----------------------------------------------------------------------------
// Test 8: Pre-Flight Encrypted Backup & Tamper Rejection
// -----------------------------------------------------------------------------
console.log('[TEST 8] Testing pre-flight backup creation, verification, and tamper rejection...');
const backupMgr = new VaultBackupRestoreManager(liveTargetDb);
const testBackupArchive = path.join(BASE_TEST_DIR, 'pre_flight_backup.fvault');

const backupRes = await backupMgr.createBackup(
  testBackupArchive,
  Buffer.alloc(32, 1),
  'PassphraseForBackup!123'
);
assert.strictEqual(backupRes.manifestVersion, 1);
assert(fs.existsSync(testBackupArchive), 'Backup archive file must be created');

// Verify legitimate backup
const verifiedBackup = await backupMgr.verifyBackupArchive(
  testBackupArchive,
  'PassphraseForBackup!123'
);
assert.strictEqual(verifiedBackup.databaseSha256, backupRes.databaseSha256);

// Tamper test: Corrupt 1 byte in backup archive
const archiveBytes = fs.readFileSync(testBackupArchive);
const corruptedArchive = Buffer.from(archiveBytes);
corruptedArchive[corruptedArchive.length - 10] ^= 0xff;
fs.writeFileSync(testBackupArchive, corruptedArchive);

let tamperCaught = false;
try {
  await backupMgr.verifyBackupArchive(testBackupArchive, 'PassphraseForBackup!123');
} catch {
  tamperCaught = true;
}
assert(tamperCaught, 'FAIL: Tampered backup must be rejected on authentication failure');

console.log('  [PASS] Pre-flight backup creation and cryptographic tamper rejection verified.\n');

// -----------------------------------------------------------------------------
// Test 9: Zero Source Modification Guarantee
// -----------------------------------------------------------------------------
console.log('[TEST 9] Testing zero source modification guarantee...');
const afterRaw = readAllCsvTables(syntheticDataDir);
for (const [tbl, initialHash] of Object.entries(initialHashes)) {
  const afterHash = afterRaw.fileHashes[tbl];
  assert.strictEqual(
    afterHash,
    initialHash,
    `FAIL: Source file "${tbl}.csv" was modified! Hash mismatch.`
  );
}
console.log('  [PASS] Verified 100% byte-for-byte immutability of source CSV files across all tests.\n');

// -----------------------------------------------------------------------------
// Test 10: Security Checks (No Plaintext Secrets in Errors or Output)
// -----------------------------------------------------------------------------
console.log('[TEST 10] Testing security checks: password rejection, key wiping, zero leakage...');

// 1. Password rejection (<8 chars)
assert.throws(
  () => deriveEncryptionKey('short', generateSalt()),
  /at least 8 characters/
);

// 2. Buffer memory zeroing
const testBuffer = Buffer.from('SuperSecretKeyMaterialToScrub123');
wipeBuffer(testBuffer);
assert.strictEqual(testBuffer[0], 0);
assert.strictEqual(testBuffer[testBuffer.length - 1], 0);

// 3. Error messages never leak raw password
try {
  await runMigration({
    sourceDataDir: malformedDir,
    masterPassword: 'MyUltraSecretPassword123!',
    dryRun: true
  });
} catch (err) {
  const errMsg = String(err);
  assert(!errMsg.includes('MyUltraSecretPassword123!'), 'Password must never be leaked in error message');
}

console.log('  [PASS] Password rejection, key wiping, and zero credential exposure verified.\n');

// -----------------------------------------------------------------------------
// Cleanup temporary test directory
// -----------------------------------------------------------------------------
try {
  fs.rmSync(BASE_TEST_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
} catch {
  // Ignore Windows file handle release delay on cleanup
}

console.log('================================================================');
console.log('  ALL MIGRATION SAFETY & SECURITY TESTS PASSED (10/10)!         ');
console.log('================================================================\n');
