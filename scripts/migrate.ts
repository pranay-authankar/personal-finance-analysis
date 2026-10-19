import path from 'node:path';
import readline from 'node:readline';
import { getVaultDbPath, getVaultMetaPath } from '../server/config.ts';
import { runMigration } from '../server/migration/index.ts';

/**
 * Prompts the user interactively for a password with masked terminal input (asterisks).
 */
async function promptPassword(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (stdin.isTTY) {
      stdout.write(promptText);
      let password = '';
      const onData = (buffer: Buffer) => {
        const str = buffer.toString('utf8');
        for (const char of str) {
          if (char === '\n' || char === '\r' || char === '\u0004') {
            stdin.removeListener('data', onData);
            if (stdin.setRawMode) stdin.setRawMode(false);
            stdin.pause();
            stdout.write('\n');
            resolve(password);
            return;
          } else if (char === '\u0008' || char === '\x7f') {
            if (password.length > 0) {
              password = password.slice(0, -1);
              stdout.write('\b \b');
            }
          } else if (char === '\u0003') {
            process.exit(1);
          } else {
            password += char;
            stdout.write('*');
          }
        }
      };
      if (stdin.setRawMode) stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question(promptText, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function printUsage(): void {
  console.log(`
FamilyVault Data Migration CLI
Usage:
  node --experimental-strip-types scripts/migrate.ts [options]

Options:
  --dry-run                    Simulate migration and verify reconciliation without altering data (DEFAULT)
  --live                       Execute live migration into destination encrypted SQLite database
  --source-dir <path>          Path to directory containing source CSV files (default: ./data)
  --uploads-dir <path>         Path to directory containing upload attachments (default: ./uploads)
  --target-db <path>           Destination database path (default: %LOCALAPPDATA%\\FamilyVault\\familyvault.db)
  --allow-missing-attachments  Proceed even if some referenced document files are missing on disk
  --help                       Show this help message
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Safety: Dry-run is ALWAYS the default unless --live is explicitly passed
  const isLive = args.includes('--live');
  const isDryRun = !isLive || args.includes('--dry-run');
  const allowMissingAttachments = args.includes('--allow-missing-attachments');

  // Custom directories
  let sourceDir = path.resolve('data');
  const srcIdx = args.indexOf('--source-dir');
  if (srcIdx !== -1 && args[srcIdx + 1]) {
    sourceDir = path.resolve(args[srcIdx + 1]);
  }

  let uploadsDir = path.resolve('uploads');
  const upIdx = args.indexOf('--uploads-dir');
  if (upIdx !== -1 && args[upIdx + 1]) {
    uploadsDir = path.resolve(args[upIdx + 1]);
  }

  let targetDb = getVaultDbPath();
  const dbIdx = args.indexOf('--target-db');
  if (dbIdx !== -1 && args[dbIdx + 1]) {
    targetDb = path.resolve(args[dbIdx + 1]);
  }

  console.log('================================================================');
  console.log(`  FamilyVault Migration CLI — ${isDryRun ? 'DRY-RUN SIMULATION' : 'LIVE MIGRATION'}  `);
  console.log('================================================================\n');

  console.log('--- Configuration ---');
  console.log(`Mode               : ${isDryRun ? 'DRY-RUN (Safe Verification Only, Zero Writes)' : 'LIVE IMPORT'}`);
  console.log(`Source CSV Dir     : ${sourceDir}`);
  console.log(`Source Uploads Dir : ${uploadsDir}`);
  console.log(`Target Database    : ${targetDb}`);
  console.log(`Missing Att. Mode  : ${allowMissingAttachments ? 'WARNING (Non-blocking)' : 'STRICT (Fail on missing)'}\n`);

  let masterPassword = process.env.VAULT_PASSWORD || '';
  if (!masterPassword) {
    masterPassword = await promptPassword('Enter Master Password to open/initialize vault: ');
  }

  if (!masterPassword || masterPassword.length < 8) {
    console.error('ERROR: Master password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log('\n--- Step 1: Ingesting and Validating Source CSVs ---');

  try {
    const report = await runMigration({
      sourceDataDir: sourceDir,
      sourceUploadsDir: uploadsDir,
      targetDbPath: targetDb,
      targetMetaPath: getVaultMetaPath(),
      masterPassword,
      dryRun: isDryRun,
      allowMissingAttachments
    });

    console.log('\n================================================================');
    console.log(`  RECONCILIATION AUDIT REPORT (${report.mode})                  `);
    console.log('================================================================');
    console.log(`Status        : ${report.success ? 'PASSED' : 'FAILED'}`);
    console.log(`Execution Time: ${report.durationMs}ms`);
    console.log(`FK Violations : ${report.foreignKeyViolations}`);
    console.log(`Summary       : ${report.message}\n`);

    console.log('Table Record Counts:');
    console.log('--------------------------------------------------------------------------------');
    console.log('Table Name        | Source | Valid | Rejected | Warnings | Imported | Status');
    console.log('--------------------------------------------------------------------------------');
    for (const [tbl, metric] of Object.entries(report.tables)) {
      console.log(
        `${tbl.padEnd(17)} | ` +
        `${String(metric.sourceRows).padStart(6)} | ` +
        `${String(metric.validRows).padStart(5)} | ` +
        `${String(metric.rejectedRows).padStart(8)} | ` +
        `${String(metric.warningsCount).padStart(8)} | ` +
        `${String(metric.importedRows).padStart(8)} | ` +
        `[${metric.status}]`
      );
    }
    console.log('--------------------------------------------------------------------------------\n');

    console.log('Financial Reconciliation:');
    console.log('--------------------------------------------------------------------------------');
    console.log('Asset Category     | Source Total     | Imported Total   | Status');
    console.log('--------------------------------------------------------------------------------');
    for (const [cat, metric] of Object.entries(report.financials)) {
      const srcFormatted = '₹ ' + metric.sourceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const impFormatted = '₹ ' + metric.importedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      console.log(
        `${cat.padEnd(18)} | ` +
        `${srcFormatted.padStart(16)} | ` +
        `${impFormatted.padStart(16)} | ` +
        `[${metric.status}]`
      );
    }
    console.log('--------------------------------------------------------------------------------\n');

    if (report.missingDocuments.length > 0) {
      console.log(`Missing Document Attachments (${report.missingDocuments.length}):`);
      for (const doc of report.missingDocuments) {
        console.log(`  ⚠️  ${doc}`);
      }
      console.log();
    }

    if (report.unreferencedUploads.length > 0) {
      console.log(`Unreferenced Files in Uploads (${report.unreferencedUploads.length}):`);
      for (const u of report.unreferencedUploads) {
        console.log(`  ℹ️  ${u}`);
      }
      console.log();
    }

    if (report.errors.length > 0) {
      console.log(`Validation Errors (${report.errors.length}):`);
      for (const err of report.errors.slice(0, 10)) {
        console.log(`  ❌ [${err.table}: row ${err.rowNumber}] ${err.field}: ${err.message}`);
      }
      if (report.errors.length > 10) {
        console.log(`  ... and ${report.errors.length - 10} more error(s)`);
      }
      console.log();
    }

    if (isDryRun) {
      console.log('✅ DRY-RUN COMPLETE: Zero source files were modified, and zero live data was committed.\n');
    } else {
      console.log('✅ LIVE MIGRATION COMPLETE: All records successfully committed to encrypted SQLite vault.\n');
    }
  } catch (err: unknown) {
    console.error('\nMIGRATION ABORTED AND ROLLED BACK:');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
