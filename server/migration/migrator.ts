import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getVaultDbPath, getVaultMetaPath, CRYPTO_CONFIG } from '../config.ts';
import {
  deriveEncryptionKey,
  generateSalt,
  readVaultMetadata,
  writeVaultMetadata,
  wipeBuffer
} from '../storage/crypto.ts';
import {
  openEncryptedDatabase,
  initializeSchema,
  SqliteVaultDatabase
} from '../storage/sqliteAdapter.ts';
import { VaultBackupRestoreManager } from '../storage/backupManager.ts';
import { readAllCsvTables, CSV_TABLE_FILES } from './csvReader.ts';
import { validateDataset } from './validator.ts';
import type {
  MigrationOptions,
  MigrationReport
} from './types.ts';
import type { VaultMetadata } from '../storage/types.ts';

/**
 * Runs the FamilyVault data migration process.
 * Defaults to strict DRY_RUN mode, guaranteeing zero writes to production or source files.
 */
export async function runMigration(options: MigrationOptions): Promise<MigrationReport> {
  const startTime = Date.now();
  const isDryRun = options.dryRun !== false; // Default is true for safety
  const allowMissingAttachments = Boolean(options.allowMissingAttachments);
  const masterPassword = options.masterPassword;

  if (!masterPassword || masterPassword.length < 8) {
    throw new Error('Master password must be at least 8 characters long.');
  }

  const sourceDataDir = path.resolve(options.sourceDataDir);
  const sourceUploadsDir = options.sourceUploadsDir ? path.resolve(options.sourceUploadsDir) : undefined;
  const targetDbPath = options.targetDbPath || getVaultDbPath();
  const targetMetaPath = options.targetMetaPath || getVaultMetaPath();

  const report: MigrationReport = {
    success: false,
    mode: isDryRun ? 'DRY_RUN' : 'LIVE',
    sourceDataDir,
    targetDbPath,
    tables: {},
    financials: {},
    errors: [],
    warnings: [],
    missingDocuments: [],
    unreferencedUploads: [],
    foreignKeyViolations: 0,
    backupCreated: false,
    message: '',
    durationMs: 0
  };

  // ---------------------------------------------------------------------------
  // Step 1: Read-Only CSV Dataset Ingestion & Validation
  // ---------------------------------------------------------------------------
  const rawDataset = readAllCsvTables(sourceDataDir);
  const validation = validateDataset(rawDataset, sourceUploadsDir);

  report.tables = validation.tableMetrics;
  report.errors = validation.errors;
  report.warnings = validation.warnings;
  report.missingDocuments = validation.missingDocuments;
  report.unreferencedUploads = validation.unreferencedUploads;

  // If validation errors exist, abort immediately
  if (!validation.isValid) {
    report.success = false;
    report.message = `Pre-flight validation failed with ${validation.errors.length} fatal error(s). Migration aborted without changes.`;
    report.durationMs = Date.now() - startTime;
    if (!isDryRun) {
      throw new Error(report.message);
    }
    return report;
  }

  // Check missing documents if strict attachments enforcement is active
  if (validation.missingDocuments.length > 0 && !allowMissingAttachments) {
    report.success = false;
    report.message = `Pre-flight validation halted: ${validation.missingDocuments.length} document file(s) referenced in documents.csv are missing on disk. Pass allowMissingAttachments to proceed.`;
    report.durationMs = Date.now() - startTime;
    if (!isDryRun) {
      throw new Error(report.message);
    }
    return report;
  }

  // ---------------------------------------------------------------------------
  // Step 2: Destination Setup (Isolated Temp for Dry-Run vs Live Vault)
  // ---------------------------------------------------------------------------
  let effectiveDbPath = targetDbPath;
  let effectiveMetaPath = targetMetaPath;
  let dryRunTempDir: string | null = null;
  let keyBuffer: Buffer | null = null;
  let db: SqliteVaultDatabase | null = null;
  let salt: Buffer;
  let isNewVault = false;

  try {
    if (isDryRun) {
      dryRunTempDir = path.join(
        os.tmpdir(),
        `familyvault_dryrun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      );
      fs.mkdirSync(dryRunTempDir, { recursive: true });
      effectiveDbPath = path.join(dryRunTempDir, 'dryrun.db');
      effectiveMetaPath = path.join(dryRunTempDir, 'vault_meta.json');

      salt = generateSalt();
      keyBuffer = deriveEncryptionKey(masterPassword, salt);
      const keyHex = keyBuffer.toString('hex');

      db = openEncryptedDatabase(effectiveDbPath, keyHex);
      initializeSchema(db);
      isNewVault = true;
    } else {
      // LIVE MODE: Create pre-flight backup if existing database exists
      if (fs.existsSync(targetDbPath) && !options.skipBackup) {
        const backupManager = new VaultBackupRestoreManager(targetDbPath);
        const backupRes = await backupManager.createBackup();
        report.backupCreated = true;
        report.backupPath = backupRes.databaseSha256;
      }

      // Read or generate metadata
      const existingMeta = readVaultMetadata(targetMetaPath);
      if (existingMeta && existingMeta.kdf?.saltHex) {
        salt = Buffer.from(existingMeta.kdf.saltHex, 'hex');
        keyBuffer = deriveEncryptionKey(masterPassword, salt);
        isNewVault = false;
      } else {
        salt = generateSalt();
        keyBuffer = deriveEncryptionKey(masterPassword, salt);
        isNewVault = true;
      }

      const keyHex = keyBuffer.toString('hex');
      db = openEncryptedDatabase(effectiveDbPath, keyHex);

      if (isNewVault) {
        initializeSchema(db);
      } else {
        // Validate connection with key
        if (!db.verifyConnection()) {
          throw new Error('Invalid master password. Destination database could not be decrypted.');
        }
      }
    }

    // -------------------------------------------------------------------------
    // Step 3: Transactional Insertion of Valid Records
    // -------------------------------------------------------------------------
    db.exec('BEGIN TRANSACTION;');

    const validData = validation.validDataset;

    // 1. Family Members
    const insertFm = db.prepare(`
      INSERT INTO family_members (member_id, member_name, role, avatar)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(member_id) DO UPDATE SET
        member_name = excluded.member_name,
        role = excluded.role,
        avatar = excluded.avatar,
        updated_at = CURRENT_TIMESTAMP
    `);
    for (const fm of validData.family_members) {
      insertFm.run(
        fm.member_id.trim(),
        (fm.member_name || '').trim(),
        (fm.role || 'Family Member').trim(),
        (fm.avatar || '🧑').trim()
      );
    }

    // 2. Assets
    const insertAsset = db.prepare(`
      INSERT INTO assets (a_id, member_id, asset_type, asset_name, asset_status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(a_id) DO UPDATE SET
        member_id = excluded.member_id,
        asset_type = excluded.asset_type,
        asset_name = excluded.asset_name,
        asset_status = excluded.asset_status,
        updated_at = CURRENT_TIMESTAMP
    `);
    for (const ast of validData.assets) {
      insertAsset.run(
        ast.a_id.trim(),
        ast.member_id.trim(),
        ast.asset_type.trim().toUpperCase(),
        (ast.asset_name || '').trim(),
        (ast.asset_status || 'ACTIVE').trim().toUpperCase()
      );
    }

    // 3. Fixed Deposits
    const insertFd = db.prepare(`
      INSERT INTO fds (fd_id, a_id, bank_name, acc_number, principal, interest_rate, start_date, maturity_date, actual_end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fd_id) DO UPDATE SET
        a_id = excluded.a_id,
        bank_name = excluded.bank_name,
        acc_number = excluded.acc_number,
        principal = excluded.principal,
        interest_rate = excluded.interest_rate,
        start_date = excluded.start_date,
        maturity_date = excluded.maturity_date,
        actual_end_date = excluded.actual_end_date
    `);
    for (const fd of validData.fds) {
      insertFd.run(
        fd.fd_id.trim(),
        fd.a_id.trim(),
        (fd.bank_name || '').trim(),
        (fd.acc_number || '').trim(),
        Number(fd.principal) || 0,
        Number(fd.interest_rate) || 0,
        (fd.start_date || '').trim(),
        (fd.maturity_date || '').trim(),
        (fd.actual_end_date || '').trim()
      );
    }

    // 4. Post Office
    const insertPo = db.prepare(`
      INSERT INTO post_office (po_id, a_id, scheme_name, account_number, principal, interest_rate, start_date, maturity_date, actual_end_date, scheme_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(po_id) DO UPDATE SET
        a_id = excluded.a_id,
        scheme_name = excluded.scheme_name,
        account_number = excluded.account_number,
        principal = excluded.principal,
        interest_rate = excluded.interest_rate,
        start_date = excluded.start_date,
        maturity_date = excluded.maturity_date,
        actual_end_date = excluded.actual_end_date,
        scheme_status = excluded.scheme_status
    `);
    for (const po of validData.post_office) {
      insertPo.run(
        po.po_id.trim(),
        po.a_id.trim(),
        (po.scheme_name || '').trim(),
        (po.account_number || '').trim(),
        po.principal !== null && po.principal !== undefined && po.principal !== '' ? Number(po.principal) : null,
        Number(po.interest_rate) || 0,
        (po.start_date || '').trim(),
        (po.maturity_date || '').trim(),
        (po.actual_end_date || '').trim(),
        (po.scheme_status || 'ACTIVE').trim()
      );
    }

    // 5. Bullions
    const insertBul = db.prepare(`
      INSERT INTO bullions (b_id, a_id, b_type, purchase_value, purchase_date, b_status, payment_due_date, weight, weight_unit, purchase_rate, weight_display)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(b_id) DO UPDATE SET
        a_id = excluded.a_id,
        b_type = excluded.b_type,
        purchase_value = excluded.purchase_value,
        purchase_date = excluded.purchase_date,
        b_status = excluded.b_status,
        payment_due_date = excluded.payment_due_date,
        weight = excluded.weight,
        weight_unit = excluded.weight_unit,
        purchase_rate = excluded.purchase_rate,
        weight_display = excluded.weight_display
    `);
    for (const b of validData.bullions) {
      insertBul.run(
        b.b_id.trim(),
        b.a_id.trim(),
        (b.b_type || '').trim().toUpperCase(),
        Number(b.purchase_value) || 0,
        (b.purchase_date || '').trim(),
        (b.b_status || 'HELD').trim().toUpperCase(),
        (b.payment_due_date || '').trim(),
        Number(b.weight) || 0,
        (b.weight_unit || '').trim(),
        Number(b.purchase_rate) || 0,
        (b.weight_display || '').trim()
      );
    }

    // 6. Properties
    const insertProp = db.prepare(`
      INSERT INTO properties (p_id, a_id, p_type, name, location, area_sqft, area_unit, purchase_price, party_name, party_contact, purchase_date, p_notes, payment_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(p_id) DO UPDATE SET
        a_id = excluded.a_id,
        p_type = excluded.p_type,
        name = excluded.name,
        location = excluded.location,
        area_sqft = excluded.area_sqft,
        area_unit = excluded.area_unit,
        purchase_price = excluded.purchase_price,
        party_name = excluded.party_name,
        party_contact = excluded.party_contact,
        purchase_date = excluded.purchase_date,
        p_notes = excluded.p_notes,
        payment_deadline = excluded.payment_deadline
    `);
    for (const p of validData.properties) {
      insertProp.run(
        p.p_id.trim(),
        p.a_id.trim(),
        (p.p_type || 'LAND').trim(),
        (p.name || '').trim(),
        (p.location || '').trim(),
        (p.area_sqft || '').trim(),
        (p.area_unit || '').trim(),
        Number(p.purchase_price) || 0,
        (p.party_name || '').trim(),
        (p.party_contact || '').trim(),
        (p.purchase_date || '').trim(),
        (p.p_notes || '').trim(),
        (p.payment_deadline || '').trim()
      );
    }

    // 7. Rents
    const insertRent = db.prepare(`
      INSERT INTO rents (r_id, p_id, tenant_name, tenant_contact, rent_amount, rent_start_date, rent_end_date, next_rent_due, r_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(r_id) DO UPDATE SET
        p_id = excluded.p_id,
        tenant_name = excluded.tenant_name,
        tenant_contact = excluded.tenant_contact,
        rent_amount = excluded.rent_amount,
        rent_start_date = excluded.rent_start_date,
        rent_end_date = excluded.rent_end_date,
        next_rent_due = excluded.next_rent_due,
        r_notes = excluded.r_notes
    `);
    for (const r of validData.rents) {
      insertRent.run(
        r.r_id.trim(),
        r.p_id.trim(),
        (r.tenant_name || '').trim(),
        (r.tenant_contact || '').trim(),
        Number(r.rent_amount) || 0,
        (r.rent_start_date || '').trim(),
        (r.rent_end_date || '').trim(),
        (r.next_rent_due || '').trim(),
        (r.r_notes || '').trim()
      );
    }

    // 8. Asset Sales
    const insertSale = db.prepare(`
      INSERT INTO asset_sales (sale_id, a_id, buyer_name, buyer_contact, sale_price, sale_date, payment_due_date, sale_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sale_id) DO UPDATE SET
        a_id = excluded.a_id,
        buyer_name = excluded.buyer_name,
        buyer_contact = excluded.buyer_contact,
        sale_price = excluded.sale_price,
        sale_date = excluded.sale_date,
        payment_due_date = excluded.payment_due_date,
        sale_notes = excluded.sale_notes
    `);
    for (const s of validData.asset_sales) {
      insertSale.run(
        s.sale_id.trim(),
        s.a_id.trim(),
        (s.buyer_name || '').trim(),
        (s.buyer_contact || '').trim(),
        Number(s.sale_price) || 0,
        (s.sale_date || '').trim(),
        (s.payment_due_date || '').trim(),
        (s.sale_notes || '').trim()
      );
    }

    // 9. Payments
    const insertPay = db.prepare(`
      INSERT INTO payments (payment_id, a_id, payment_type, payment_context, amount, payment_date, due_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(payment_id) DO UPDATE SET
        a_id = excluded.a_id,
        payment_type = excluded.payment_type,
        payment_context = excluded.payment_context,
        amount = excluded.amount,
        payment_date = excluded.payment_date,
        due_date = excluded.due_date,
        status = excluded.status,
        notes = excluded.notes
    `);
    for (const py of validData.payments) {
      insertPay.run(
        py.payment_id.trim(),
        py.a_id.trim(),
        (py.payment_type || 'PURCHASE').trim().toUpperCase(),
        (py.payment_context || 'PURCHASE').trim().toUpperCase(),
        Number(py.amount) || 0,
        (py.payment_date || '').trim(),
        (py.due_date || '').trim(),
        (py.status || 'PENDING').trim().toUpperCase(),
        (py.notes || '').trim()
      );
    }

    // 10. Documents
    const insertDoc = db.prepare(`
      INSERT INTO documents (d_id, a_id, r_id, d_category, d_name, d_link)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(d_id) DO UPDATE SET
        a_id = excluded.a_id,
        r_id = excluded.r_id,
        d_category = excluded.d_category,
        d_name = excluded.d_name,
        d_link = excluded.d_link
    `);
    for (const d of validData.documents) {
      insertDoc.run(
        d.d_id.trim(),
        d.a_id.trim(),
        (d.r_id || '').trim(),
        (d.d_category || 'OTHER').trim(),
        (d.d_name || '').trim(),
        (d.d_link || '').trim()
      );
    }

    // 11. Contributions
    const insertCnt = db.prepare(`
      INSERT INTO contributions (contribution_id, a_id, contribution_type, amount, frequency, due_date, payment_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(contribution_id) DO UPDATE SET
        a_id = excluded.a_id,
        contribution_type = excluded.contribution_type,
        amount = excluded.amount,
        frequency = excluded.frequency,
        due_date = excluded.due_date,
        payment_date = excluded.payment_date,
        status = excluded.status,
        notes = excluded.notes
    `);
    for (const c of validData.contributions) {
      insertCnt.run(
        c.contribution_id.trim(),
        c.a_id.trim(),
        (c.contribution_type || 'RD_DEPOSIT').trim(),
        Number(c.amount) || 0,
        (c.frequency || 'MONTHLY').trim(),
        (c.due_date || '').trim(),
        (c.payment_date || '').trim(),
        (c.status || 'PENDING').trim().toUpperCase(),
        (c.notes || '').trim()
      );
    }

    // -------------------------------------------------------------------------
    // Step 4: Post-Import Integrity & Foreign-Key Checks
    // -------------------------------------------------------------------------
    const fkErrors = db.pragma('foreign_key_check') as unknown[];
    if (Array.isArray(fkErrors) && fkErrors.length > 0) {
      report.foreignKeyViolations = fkErrors.length;
      throw new Error(`Foreign-key constraint validation failed with ${fkErrors.length} violation(s).`);
    }

    // Verify row counts for each table
    for (const tableName of CSV_TABLE_FILES) {
      const rowCountRes = db.prepare(`SELECT count(*) as count FROM ${tableName}`).get() as { count: number };
      const importedCount = rowCountRes?.count || 0;
      report.tables[tableName].importedRows = importedCount;

      if (importedCount !== report.tables[tableName].validRows) {
        report.tables[tableName].status = 'DISCREPANCY';
        throw new Error(
          `Record count discrepancy in table "${tableName}": expected ${report.tables[tableName].validRows}, found ${importedCount}.`
        );
      } else {
        report.tables[tableName].status = 'MATCHED';
      }
    }

    // -------------------------------------------------------------------------
    // Step 5: Exact Financial Reconciliation Queries
    // -------------------------------------------------------------------------
    const reconcileCategory = (
      categoryName: string,
      sourceSum: number,
      querySql: string
    ) => {
      const row = db!.prepare(querySql).get() as { total: number };
      const destSum = Number(row?.total) || 0;
      const diff = Math.abs(destSum - sourceSum);
      const isReconciled = diff < 0.001;

      report.financials[categoryName] = {
        category: categoryName,
        sourceTotal: sourceSum,
        importedTotal: destSum,
        difference: diff,
        status: isReconciled ? 'RECONCILED' : 'MISMATCH'
      };

      if (!isReconciled) {
        throw new Error(
          `Financial reconciliation mismatch in "${categoryName}": source ₹${sourceSum} !== destination ₹${destSum} (diff: ₹${diff})`
        );
      }
    };

    // 5.1 Fixed Deposits
    reconcileCategory(
      'Fixed Deposits',
      validation.sourceFinancials['Fixed Deposits'],
      `SELECT coalesce(sum(f.principal), 0) as total
       FROM fds f
       JOIN assets a ON f.a_id = a.a_id
       WHERE (f.actual_end_date IS NULL OR f.actual_end_date = '')
         AND a.asset_status = 'ACTIVE'`
    );

    // 5.2 Post Office
    reconcileCategory(
      'Post Office',
      validation.sourceFinancials['Post Office'],
      `SELECT (
        coalesce((
          SELECT sum(p.principal)
          FROM post_office p
          JOIN assets a ON p.a_id = a.a_id
          WHERE (p.actual_end_date IS NULL OR p.actual_end_date = '')
            AND a.asset_status = 'ACTIVE'
            AND lower(p.scheme_name) NOT LIKE '%recurring%'
            AND lower(p.scheme_name) NOT LIKE '%(rd)%'
        ), 0)
        +
        coalesce((
          SELECT sum(c.amount)
          FROM contributions c
          WHERE c.status = 'PAID'
            AND c.a_id IN (
              SELECT p.a_id
              FROM post_office p
              JOIN assets a ON p.a_id = a.a_id
              WHERE (p.actual_end_date IS NULL OR p.actual_end_date = '')
                AND a.asset_status = 'ACTIVE'
                AND (lower(p.scheme_name) LIKE '%recurring%' OR lower(p.scheme_name) LIKE '%(rd)%')
            )
        ), 0)
      ) as total`
    );

    // 5.3 Bullions
    reconcileCategory(
      'Bullions',
      validation.sourceFinancials['Bullions'],
      `SELECT coalesce(sum(b.purchase_value), 0) as total
       FROM bullions b
       JOIN assets a ON b.a_id = a.a_id
       WHERE b.b_status = 'HELD'
         AND a.asset_status = 'ACTIVE'`
    );

    // 5.4 Real Estate
    reconcileCategory(
      'Real Estate',
      validation.sourceFinancials['Real Estate'],
      `SELECT coalesce(sum(p.purchase_price), 0) as total
       FROM properties p
       JOIN assets a ON p.a_id = a.a_id
       WHERE a.asset_status = 'ACTIVE'`
    );

    // 5.5 Realized Funds
    reconcileCategory(
      'Realized Funds',
      validation.sourceFinancials['Realized Funds'],
      `SELECT coalesce(sum(amount), 0) as total
       FROM payments
       WHERE payment_type = 'RECEIVED'
         AND payment_context IN ('SALE', 'MATURITY')
         AND status IN ('RECEIVED', 'PAID')`
    );

    // 5.6 Overall Net Worth
    reconcileCategory(
      'Overall Net Worth',
      validation.sourceFinancials['Overall Net Worth'],
      `SELECT (
        coalesce((SELECT sum(f.principal) FROM fds f JOIN assets a ON f.a_id = a.a_id WHERE (f.actual_end_date IS NULL OR f.actual_end_date = '') AND a.asset_status = 'ACTIVE'), 0)
        +
        coalesce((SELECT sum(p.principal) FROM post_office p JOIN assets a ON p.a_id = a.a_id WHERE (p.actual_end_date IS NULL OR p.actual_end_date = '') AND a.asset_status = 'ACTIVE' AND lower(p.scheme_name) NOT LIKE '%recurring%' AND lower(p.scheme_name) NOT LIKE '%(rd)%'), 0)
        +
        coalesce((SELECT sum(c.amount) FROM contributions c WHERE c.status = 'PAID' AND c.a_id IN (SELECT p.a_id FROM post_office p JOIN assets a ON p.a_id = a.a_id WHERE (p.actual_end_date IS NULL OR p.actual_end_date = '') AND a.asset_status = 'ACTIVE' AND (lower(p.scheme_name) LIKE '%recurring%' OR lower(p.scheme_name) LIKE '%(rd)%'))), 0)
        +
        coalesce((SELECT sum(b.purchase_value) FROM bullions b JOIN assets a ON b.a_id = a.a_id WHERE b.b_status = 'HELD' AND a.asset_status = 'ACTIVE'), 0)
        +
        coalesce((SELECT sum(p.purchase_price) FROM properties p JOIN assets a ON p.a_id = a.a_id WHERE a.asset_status = 'ACTIVE'), 0)
        +
        coalesce((SELECT sum(amount) FROM payments WHERE payment_type = 'RECEIVED' AND payment_context IN ('SALE', 'MATURITY') AND status IN ('RECEIVED', 'PAID')), 0)
      ) as total`
    );

    // -------------------------------------------------------------------------
    // Step 6: Migration Ledger Recording
    // -------------------------------------------------------------------------
    const insertLedger = db.prepare(`
      INSERT OR REPLACE INTO _migration_ledger (source_table, records_read, records_imported, file_sha256)
      VALUES (?, ?, ?, ?)
    `);

    for (const tableName of CSV_TABLE_FILES) {
      insertLedger.run(
        tableName,
        report.tables[tableName].sourceRows,
        report.tables[tableName].importedRows,
        rawDataset.fileHashes[tableName] || ''
      );
    }

    // -------------------------------------------------------------------------
    // Step 7: Finalize Transaction (Rollback on dry run vs Commit on live)
    // -------------------------------------------------------------------------
    if (isDryRun) {
      db.exec('ROLLBACK;');
      report.success = true;
      report.message =
        'Dry run completed successfully. 100% record and financial parity confirmed in isolated sandbox.';
    } else {
      db.exec('COMMIT;');

      if (isNewVault) {
        const meta: VaultMetadata = {
          version: 1,
          kdf: {
            algorithm: 'PBKDF2-HMAC-SHA512',
            iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
            saltHex: salt.toString('hex'),
            digest: CRYPTO_CONFIG.DIGEST
          },
          cipher: CRYPTO_CONFIG.CIPHER,
          pageSize: CRYPTO_CONFIG.PAGE_SIZE,
          createdAt: new Date().toISOString(),
          lastUnlockedAt: new Date().toISOString()
        };
        writeVaultMetadata(meta, effectiveMetaPath);
      }

      report.success = true;
      report.message =
        'Migration completed successfully. 100% record and financial parity confirmed in encrypted SQLite database.';
    }
  } catch (err: unknown) {
    if (db) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback error if transaction was already aborted
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    report.success = false;
    report.message = `Migration aborted: ${message}`;
    throw new Error(report.message);
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
    }
    wipeBuffer(keyBuffer);

    // Clean up temporary dry-run sandbox
    if (dryRunTempDir && fs.existsSync(dryRunTempDir)) {
      try {
        fs.rmSync(dryRunTempDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      } catch {
        // Ignore file lock release delay on Windows
      }
    }

    report.durationMs = Date.now() - startTime;
  }

  return report;
}
