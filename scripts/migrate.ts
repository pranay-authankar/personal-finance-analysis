import path from 'node:path';
import { getVaultDbPath, getVaultMetaPath } from '../server/config.ts';
import { createPreFlightBackup } from '../server/migration/backup.ts';
import { runMigration } from '../server/migration/migrator.ts';

/**
 * FamilyVault Phase 3 Migration CLI Runner
 * Usage:
 *   node --experimental-strip-types scripts/migrate.ts [--dry-run]
 *
 * Password should be provided via VAULT_PASSWORD environment variable.
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const masterPassword = process.env.VAULT_PASSWORD || '';

  console.log('================================================================');
  console.log(`  FamilyVault Data Migration — Phase 3 Runner ${isDryRun ? '(DRY RUN)' : ''}  `);
  console.log('================================================================\n');

  if (!masterPassword || masterPassword.length < 8) {
    console.error('ERROR: Master password must be provided via VAULT_PASSWORD env variable and be >= 8 characters.');
    console.error('Example: $env:VAULT_PASSWORD="YourStrongPassword123!"; node --experimental-strip-types scripts/migrate.ts --dry-run');
    process.exit(1);
  }

  const sourceDataDir = path.resolve('data');
  const sourceUploadsDir = path.resolve('uploads');
  const targetDbPath = getVaultDbPath();
  const targetMetaPath = getVaultMetaPath();

  console.log('--- Configuration ---');
  console.log(`Source Data Dir    : ${sourceDataDir}`);
  console.log(`Source Uploads Dir : ${sourceUploadsDir}`);
  console.log(`Target Database    : ${targetDbPath}`);
  console.log(`Target Metadata    : ${targetMetaPath}`);
  console.log(`Mode               : ${isDryRun ? 'Dry Run (Validation & Rollback)' : 'Full Transactional Migration'}\n`);

  // Step 1: Pre-flight Backup & SHA-256 Manifest
  console.log('--- Step 1: Creating Pre-Flight Backup with SHA-256 Manifest ---');
  const backupResult = createPreFlightBackup(sourceDataDir, sourceUploadsDir);
  if (!backupResult.verified) {
    console.error(`FAIL: Pre-flight backup failed verification: ${backupResult.error}`);
    process.exit(1);
  }
  console.log(`Backup Location: ${backupResult.backupDir}`);
  console.log(`Manifest Path  : ${backupResult.manifestPath}`);
  console.log(`Total Files    : ${backupResult.manifest.totalFiles} (${backupResult.manifest.totalBytes} bytes)`);
  console.log('-> Backup verification SUCCESSFUL (all file copy SHA-256 checksums matched).\n');

  // Step 2: Run Transactional Migration
  console.log('--- Step 2: Executing Transactional Migration & Verification ---');
  try {
    const report = runMigration({
      sourceDataDir,
      sourceUploadsDir,
      targetDbPath,
      targetMetaPath,
      masterPassword,
      isDryRun
    });

    console.log('\n--- Migration Audit Results ---');
    console.log(`Status        : ${report.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Message       : ${report.message}`);
    console.log(`FK Violations : ${report.foreignKeyViolations}`);
    console.log(`Docs Checked  : ${report.totalDocumentsChecked}`);
    console.log(`Docs Missing  : ${report.totalDocumentsMissing}`);

    console.log('\nTable Reconciliation:');
    for (const [tbl, metric] of Object.entries(report.tables)) {
      console.log(`  - ${tbl.padEnd(16)} : Source=${metric.sourceRows}, Imported=${metric.importedRows} [${metric.status}]`);
    }

    console.log('\nFinancial Totals Reconciliation:');
    for (const [cat, metric] of Object.entries(report.financials)) {
      console.log(`  - ${cat.padEnd(16)} : Source=₹${metric.sourceTotal.toLocaleString('en-IN')}, Imported=₹${metric.importedTotal.toLocaleString('en-IN')} [${metric.status}]`);
    }

    console.log('\n================================================================');
    console.log(`  MIGRATION ${report.success ? 'COMPLETED SUCCESSFULLY' : 'FAILED'}  `);
    console.log('================================================================');
  } catch (err: unknown) {
    console.error('\nMIGRATION FAILED AND ROLLED BACK:');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
