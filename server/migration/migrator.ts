import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type { Database } from 'better-sqlite3-multiple-ciphers';

import {
  openEncryptedDatabase,
  initializeSchema,
  verifyDatabaseConnection
} from '../db.ts';
import {
  deriveEncryptionKey,
  wipeBuffer,
  type VaultMetadata
} from '../crypto.ts';
import { CRYPTO_CONFIG } from '../config.ts';
import { computeFileSha256 } from './backup.ts';

// ============================================================================
// Types & Report Structures
// ============================================================================

export interface TableAuditMetric {
  tableName: string;
  sourceRows: number;
  importedRows: number;
  fileSha256: string;
  status: 'MATCHED' | 'DISCREPANCY';
}

export interface FinancialReconciliationMetric {
  category: string;
  sourceTotal: number;
  importedTotal: number;
  difference: number;
  status: 'MATCHED' | 'DISCREPANCY';
}

export interface MigrationAuditReport {
  timestamp: string;
  isDryRun: boolean;
  dbPath: string;
  tables: Record<string, TableAuditMetric>;
  financials: Record<string, FinancialReconciliationMetric>;
  totalDocumentsChecked: number;
  totalDocumentsMissing: number;
  missingDocumentFiles: string[];
  unreferencedUploadFiles: string[];
  foreignKeyViolations: number;
  success: boolean;
  message: string;
  error?: string;
}

export interface MigrationOptions {
  sourceDataDir: string;
  sourceUploadsDir: string;
  targetDbPath: string;
  targetMetaPath: string;
  masterPassword: string;
  isDryRun?: boolean;
  allowMissingAttachments?: boolean;
}

// ============================================================================
// RFC-4180 CSV Parsing Helper
// ============================================================================

export function parseCsvRaw(csvText: string): Array<Record<string, string>> {
  if (!csvText || !csvText.trim()) return [];

  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const splitLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inside = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const nc = line[i + 1];

      if (c === '"') {
        if (inside && nc === '"') {
          field += '"';
          i++;
        } else {
          inside = !inside;
        }
      } else if (c === ',' && !inside) {
        fields.push(field);
        field = '';
      } else {
        field += c;
      }
    }
    fields.push(field);
    return fields;
  };

  const headers = splitLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const rawFields = splitLine(lines[i]);
    if (rawFields.length === 0 || (rawFields.length === 1 && !rawFields[0].trim())) {
      continue;
    }

    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c];
      let val = rawFields[c] !== undefined ? rawFields[c].trim() : '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      rowObj[colName] = val;
    }
    records.push(rowObj);
  }

  return records;
}

// ============================================================================
// Document Verification Helpers
// ============================================================================

export function extractDocFilename(link: string): string {
  if (!link) return '';
  return link.replace(/^\/?uploads\//i, '').trim();
}

export function getUploadFilesRecursive(dir: string, baseDir = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getUploadFilesRecursive(full, baseDir));
      } else if (entry.isFile()) {
        results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
      }
    }
  } catch {}
  return results;
}

// ============================================================================
// Core Migration Engine
// ============================================================================

export function runMigration(options: MigrationOptions): MigrationAuditReport {
  const {
    sourceDataDir,
    sourceUploadsDir,
    targetDbPath,
    targetMetaPath,
    masterPassword,
    isDryRun = false,
    allowMissingAttachments = false
  } = options;

  let dryRunTempDir: string | null = null;
  let effectiveDbPath = targetDbPath;
  let effectiveMetaPath = targetMetaPath;

  if (isDryRun) {
    dryRunTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'familyvault_dryrun_'));
    effectiveDbPath = path.join(dryRunTempDir, 'dryrun_familyvault.db');
    effectiveMetaPath = path.join(dryRunTempDir, 'dryrun_vault_meta.json');
  } else {
    // 1. Partial vault and overwrite protection (Real Migration)
    const dbExists = fs.existsSync(targetDbPath);
    const metaExists = fs.existsSync(targetMetaPath);

    if (dbExists || metaExists) {
      if (dbExists && !metaExists) {
        throw new Error(
          `Refusing to initialize: Existing database found at ${targetDbPath} without metadata file (${targetMetaPath}). Incomplete vault state detected. Cannot safely verify or overwrite existing vault without explicit manual recovery.`
        );
      }
      if (!dbExists && metaExists) {
        throw new Error(
          `Refusing to initialize: Existing metadata found at ${targetMetaPath} without database file (${targetDbPath}). Incomplete vault state detected.`
        );
      }

      // Both exist: Inspect safely without modifying or deleting
      try {
        const meta = JSON.parse(fs.readFileSync(targetMetaPath, 'utf8')) as VaultMetadata;
        const salt = Buffer.from(meta.kdf.saltHex, 'hex');
        const keyBuffer = deriveEncryptionKey(masterPassword, salt);
        const dbCheck = openEncryptedDatabase(targetDbPath, keyBuffer.toString('hex'));
        wipeBuffer(keyBuffer);

        const ledgerCount = dbCheck
          .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='_migration_ledger';")
          .get() as { count: number };

        if (ledgerCount?.count > 0) {
          const rows = dbCheck.prepare('SELECT count(*) as count FROM _migration_ledger;').get() as { count: number };
          if (rows?.count > 0) {
            dbCheck.close();
            throw new Error('Database already exists and contains completed migration records. Refusing to duplicate data.');
          }
        }

        const tableCount = dbCheck
          .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
          .get() as { count: number };
        dbCheck.close();

        if (tableCount?.count > 0) {
          throw new Error(`Refusing to overwrite: Vault database already contains initialized tables at ${targetDbPath}.`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Refusing to duplicate') || msg.includes('Refusing to overwrite')) {
          throw err;
        }
        throw new Error(`Cannot safely verify existing vault at ${targetDbPath}: ${msg}`);
      }
    }
  }

  const timestamp = new Date().toISOString();
  const report: MigrationAuditReport = {
    timestamp,
    isDryRun,
    dbPath: effectiveDbPath,
    tables: {},
    financials: {},
    totalDocumentsChecked: 0,
    totalDocumentsMissing: 0,
    missingDocumentFiles: [],
    unreferencedUploadFiles: [],
    foreignKeyViolations: 0,
    success: false,
    message: ''
  };

  // 2. Read and parse all 11 CSV files
  const tableFiles = [
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
    'contributions'
  ];

  const parsedTables: Record<string, Array<Record<string, string>>> = {};
  const fileHashes: Record<string, string> = {};

  for (const table of tableFiles) {
    const csvFilePath = path.join(sourceDataDir, `${table}.csv`);
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`Required CSV file missing: ${table}.csv`);
    }
    const content = fs.readFileSync(csvFilePath, 'utf8');
    parsedTables[table] = parseCsvRaw(content);
    fileHashes[table] = computeFileSha256(csvFilePath);
  }

  // 3. Derive key and prepare database
  let salt: Buffer;
  let isNewVault = true;

  if (fs.existsSync(effectiveMetaPath)) {
    const meta = JSON.parse(fs.readFileSync(effectiveMetaPath, 'utf8')) as VaultMetadata;
    salt = Buffer.from(meta.kdf.saltHex, 'hex');
    isNewVault = false;
  } else {
    salt = crypto.randomBytes(CRYPTO_CONFIG.SALT_BYTES);
  }

  const keyBuffer = deriveEncryptionKey(masterPassword, salt);
  const keyHex = keyBuffer.toString('hex');

  let db: Database | null = null;
  try {
    fs.mkdirSync(path.dirname(effectiveDbPath), { recursive: true });
    db = openEncryptedDatabase(effectiveDbPath, keyHex);
    initializeSchema(db);

    if (!verifyDatabaseConnection(db)) {
      throw new Error('Database connection canary check failed after initialization.');
    }

    // Begin Atomic Transaction
    db.exec('BEGIN TRANSACTION;');

    // -------------------------------------------------------------------------
    // 4. Topologically Ordered Inserts
    // -------------------------------------------------------------------------

    // 4.1 family_members
    const insertMember = db.prepare(`
      INSERT INTO family_members (member_id, member_name, role, avatar)
      VALUES (?, ?, ?, ?)
    `);
    for (const r of parsedTables.family_members) {
      insertMember.run(
        r.member_id,
        r.member_name || 'Family Member',
        r.role || 'Family Member',
        r.avatar || '🧑'
      );
    }

    // 4.2 assets
    const insertAsset = db.prepare(`
      INSERT INTO assets (a_id, member_id, asset_type, asset_name, asset_status)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.assets) {
      insertAsset.run(
        r.a_id,
        r.member_id,
        r.asset_type,
        r.asset_name || 'Asset',
        r.asset_status || 'ACTIVE'
      );
    }

    // 4.3 fds
    const insertFd = db.prepare(`
      INSERT INTO fds (fd_id, a_id, bank_name, acc_number, principal, interest_rate, start_date, maturity_date, actual_end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.fds) {
      insertFd.run(
        r.fd_id,
        r.a_id,
        r.bank_name || 'Bank FD',
        r.acc_number || '',
        Number(r.principal) || 0,
        Number(r.interest_rate) || 0,
        r.start_date || '',
        r.maturity_date || r.end_date || '',
        r.actual_end_date || ''
      );
    }

    // 4.4 post_office
    const insertPo = db.prepare(`
      INSERT INTO post_office (po_id, a_id, scheme_name, account_number, principal, interest_rate, start_date, maturity_date, actual_end_date, scheme_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.post_office) {
      const principalVal = r.principal === '' || r.principal === undefined || r.principal === null ? null : Number(r.principal);
      insertPo.run(
        r.po_id,
        r.a_id,
        r.scheme_name || 'Post Office Scheme',
        r.account_number || '',
        principalVal,
        Number(r.interest_rate) || 0,
        r.start_date || '',
        r.maturity_date || '',
        r.actual_end_date || '',
        r.scheme_status || 'ACTIVE'
      );
    }

    // 4.5 bullions
    const insertBul = db.prepare(`
      INSERT INTO bullions (b_id, a_id, b_type, purchase_value, purchase_date, b_status, payment_due_date, weight, weight_unit, purchase_rate, weight_display)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.bullions) {
      insertBul.run(
        r.b_id,
        r.a_id,
        r.b_type || 'GOLD',
        Number(r.purchase_value) || 0,
        r.purchase_date || '',
        r.b_status || 'HELD',
        r.payment_due_date || '',
        Number(r.weight) || 0,
        r.weight_unit || 'g',
        Number(r.purchase_rate) || 0,
        r.weight_display || ''
      );
    }

    // 4.6 properties
    const insertProp = db.prepare(`
      INSERT INTO properties (p_id, a_id, p_type, name, location, area_sqft, area_unit, purchase_price, party_name, party_contact, purchase_date, p_notes, payment_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.properties) {
      insertProp.run(
        r.p_id,
        r.a_id,
        r.p_type || 'LAND',
        r.name || 'Property',
        r.location || '',
        r.area_sqft || '',
        r.area_unit || '',
        Number(r.purchase_price) || 0,
        r.party_name || '',
        r.party_contact || '',
        r.purchase_date || '',
        r.p_notes || '',
        r.payment_deadline || ''
      );
    }

    // 4.7 rents
    const insertRent = db.prepare(`
      INSERT INTO rents (r_id, p_id, tenant_name, tenant_contact, rent_amount, rent_start_date, rent_end_date, next_rent_due, r_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.rents) {
      insertRent.run(
        r.r_id,
        r.p_id,
        r.tenant_name || '',
        r.tenant_contact || '',
        Number(r.rent_amount) || 0,
        r.rent_start_date || '',
        r.rent_end_date || '',
        r.next_rent_due || '',
        r.r_notes || ''
      );
    }

    // 4.8 asset_sales
    const insertSale = db.prepare(`
      INSERT INTO asset_sales (sale_id, a_id, buyer_name, buyer_contact, sale_price, sale_date, payment_due_date, sale_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.asset_sales) {
      insertSale.run(
        r.sale_id,
        r.a_id,
        r.buyer_name || '',
        r.buyer_contact || '',
        Number(r.sale_price) || 0,
        r.sale_date || '',
        r.payment_due_date || '',
        r.sale_notes || ''
      );
    }

    // 4.9 payments
    const insertPay = db.prepare(`
      INSERT INTO payments (payment_id, a_id, payment_type, payment_context, amount, payment_date, due_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.payments) {
      insertPay.run(
        r.payment_id,
        r.a_id,
        r.payment_type || 'PURCHASE',
        r.payment_context || 'PURCHASE',
        Number(r.amount) || 0,
        r.payment_date || '',
        r.due_date || '',
        r.status || 'PENDING',
        r.notes || ''
      );
    }

    // 4.10 documents
    const insertDoc = db.prepare(`
      INSERT INTO documents (d_id, a_id, r_id, d_category, d_name, d_link)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.documents) {
      insertDoc.run(
        r.d_id,
        r.a_id,
        r.r_id || '',
        r.d_category || 'OTHER',
        r.d_name || 'Document',
        r.d_link || ''
      );
    }

    // 4.11 contributions
    const insertContrib = db.prepare(`
      INSERT INTO contributions (contribution_id, a_id, contribution_type, amount, frequency, due_date, payment_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of parsedTables.contributions) {
      insertContrib.run(
        r.contribution_id,
        r.a_id,
        r.contribution_type || 'RD_DEPOSIT',
        Number(r.amount) || 0,
        r.frequency || 'MONTHLY',
        r.due_date || '',
        r.payment_date || '',
        r.status || 'PENDING',
        r.notes || ''
      );
    }

    // -------------------------------------------------------------------------
    // 5. Foreign Key & Integrity Check
    // -------------------------------------------------------------------------
    const fkErrors = db.prepare('PRAGMA foreign_key_check;').all();
    if (fkErrors.length > 0) {
      report.foreignKeyViolations = fkErrors.length;
      throw new Error(`Foreign key constraint check FAILED with ${fkErrors.length} violations: ${JSON.stringify(fkErrors)}`);
    }

    // -------------------------------------------------------------------------
    // 6. Record Count Reconciliation
    // -------------------------------------------------------------------------
    for (const table of tableFiles) {
      const countRes = db.prepare(`SELECT count(*) as count FROM ${table};`).get() as { count: number };
      const sourceCount = parsedTables[table].length;
      const importedCount = countRes.count;

      const isMatched = sourceCount === importedCount;
      report.tables[table] = {
        tableName: table,
        sourceRows: sourceCount,
        importedRows: importedCount,
        fileSha256: fileHashes[table],
        status: isMatched ? 'MATCHED' : 'DISCREPANCY'
      };

      if (!isMatched) {
        throw new Error(
          `Row count mismatch in table ${table}: CSV has ${sourceCount} rows, SQLite has ${importedCount} rows!`
        );
      }
    }

    // -------------------------------------------------------------------------
    // 7. Document Reference Verification & Unreferenced Detection
    // -------------------------------------------------------------------------
    const referencedFiles = new Set<string>();

    for (const doc of parsedTables.documents) {
      if (doc.d_link && doc.d_link.trim()) {
        report.totalDocumentsChecked++;
        const relFile = extractDocFilename(doc.d_link);
        if (relFile) {
          const normalized = relFile.replace(/\\/g, '/');
          referencedFiles.add(normalized);
          const fullDocPath = path.join(sourceUploadsDir, relFile);
          if (!fs.existsSync(fullDocPath)) {
            report.totalDocumentsMissing++;
            if (!report.missingDocumentFiles.includes(normalized)) {
              report.missingDocumentFiles.push(normalized);
            }
          }
        }
      }
    }

    if (fs.existsSync(sourceUploadsDir)) {
      const allUploads = getUploadFilesRecursive(sourceUploadsDir);
      for (const f of allUploads) {
        if (!referencedFiles.has(f)) {
          report.unreferencedUploadFiles.push(f);
        }
      }
    }

    // Fail closed on missing referenced documents by default
    if (report.missingDocumentFiles.length > 0) {
      if (!allowMissingAttachments) {
        throw new Error(
          `Migration aborted: ${report.missingDocumentFiles.length} referenced document(s) missing from upload storage (${sourceUploadsDir}): ${report.missingDocumentFiles.join(', ')}. Use allowMissingAttachments option to explicitly override.`
        );
      }
    }

    // -------------------------------------------------------------------------
    // 8. Financial Reconciliation Check (Zero Disappearing Wealth Engine)
    // -------------------------------------------------------------------------
    const reconcileFinancials = (
      category: string,
      sourceSum: number,
      dbSql: string
    ) => {
      const dbRes = db!.prepare(dbSql).get() as { total: number };
      const importedSum = Number(dbRes?.total) || 0;
      const diff = Math.abs(sourceSum - importedSum);
      const isMatched = diff < 0.01;

      report.financials[category] = {
        category,
        sourceTotal: sourceSum,
        importedTotal: importedSum,
        difference: diff,
        status: isMatched ? 'MATCHED' : 'DISCREPANCY'
      };

      if (!isMatched) {
        throw new Error(
          `Financial reconciliation FAILED for ${category}: Source=${sourceSum}, Imported=${importedSum}, Diff=${diff}`
        );
      }
    };

    // 8.1 Active Fixed Deposits
    const sourceFdSum = parsedTables.fds
      .filter((f) => {
        const ast = parsedTables.assets.find((a) => a.a_id === f.a_id);
        return (!f.actual_end_date || f.actual_end_date.trim() === '') && ast?.asset_status === 'ACTIVE';
      })
      .reduce((s, f) => s + (Number(f.principal) || 0), 0);

    reconcileFinancials(
      'Fixed Deposits',
      sourceFdSum,
      `SELECT coalesce(sum(f.principal), 0) as total FROM fds f JOIN assets a ON f.a_id = a.a_id WHERE (f.actual_end_date IS NULL OR f.actual_end_date = '') AND a.asset_status = 'ACTIVE'`
    );

    // 8.2 Active Post Office Schemes (TD, MIS, SCSS principal + RD paid contributions)
    const activePoRecords = parsedTables.post_office.filter((p) => {
      const ast = parsedTables.assets.find((a) => a.a_id === p.a_id);
      return (!p.actual_end_date || p.actual_end_date.trim() === '') && ast?.asset_status === 'ACTIVE';
    });

    let sourcePoSum = 0;
    for (const p of activePoRecords) {
      const sName = (p.scheme_name || '').toLowerCase();
      const isRd = sName.includes('recurring') || sName.includes('(rd)');
      if (isRd) {
        const paidContribs = parsedTables.contributions.filter(
          (c) => c.a_id === p.a_id && c.status === 'PAID'
        );
        sourcePoSum += paidContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      } else {
        sourcePoSum += Number(p.principal) || 0;
      }
    }

    reconcileFinancials(
      'Post Office',
      sourcePoSum,
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

    // 8.3 Active Bullions (HELD status)
    const sourceBulSum = parsedTables.bullions
      .filter((b) => {
        const ast = parsedTables.assets.find((a) => a.a_id === b.a_id);
        return b.b_status === 'HELD' && ast?.asset_status === 'ACTIVE';
      })
      .reduce((s, b) => s + (Number(b.purchase_value) || 0), 0);

    reconcileFinancials(
      'Bullions',
      sourceBulSum,
      `SELECT coalesce(sum(b.purchase_value), 0) as total FROM bullions b JOIN assets a ON b.a_id = a.a_id WHERE b.b_status = 'HELD' AND a.asset_status = 'ACTIVE'`
    );

    // 8.4 Active Real Estate
    const sourcePropSum = parsedTables.properties
      .filter((p) => {
        const ast = parsedTables.assets.find((a) => a.a_id === p.a_id);
        return ast?.asset_status === 'ACTIVE';
      })
      .reduce((s, p) => s + (Number(p.purchase_price) || 0), 0);

    reconcileFinancials(
      'Real Estate',
      sourcePropSum,
      `SELECT coalesce(sum(p.purchase_price), 0) as total FROM properties p JOIN assets a ON p.a_id = a.a_id WHERE a.asset_status = 'ACTIVE'`
    );

    // 8.5 Realized Funds (Maturity & Sales Proceeds)
    const sourceRealizedSum = parsedTables.payments
      .filter(
        (p) =>
          p.payment_type === 'RECEIVED' &&
          (p.payment_context === 'SALE' || p.payment_context === 'MATURITY') &&
          (p.status === 'RECEIVED' || p.status === 'PAID')
      )
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    reconcileFinancials(
      'Realized Funds',
      sourceRealizedSum,
      `SELECT coalesce(sum(amount), 0) as total FROM payments WHERE payment_type = 'RECEIVED' AND payment_context IN ('SALE', 'MATURITY') AND status IN ('RECEIVED', 'PAID')`
    );

    // 8.6 Overall Net Worth
    const sourceNetWorth = sourceFdSum + sourcePoSum + sourceBulSum + sourcePropSum + sourceRealizedSum;
    reconcileFinancials(
      'Overall Net Worth',
      sourceNetWorth,
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
    // 9. Record Ledger Entries
    // -------------------------------------------------------------------------
    const insertLedger = db.prepare(`
      INSERT INTO _migration_ledger (source_table, records_read, records_imported, file_sha256)
      VALUES (?, ?, ?, ?)
    `);

    for (const table of tableFiles) {
      insertLedger.run(
        table,
        parsedTables[table].length,
        parsedTables[table].length,
        fileHashes[table]
      );
    }

    // -------------------------------------------------------------------------
    // 10. Commit or Rollback
    // -------------------------------------------------------------------------
    if (isDryRun) {
      db.exec('ROLLBACK;');
      report.success = true;
      report.message = 'Dry run completed successfully. All validations passed in isolated temporary vault.';
    } else {
      db.exec('COMMIT;');

      // If new vault, write metadata
      if (isNewVault) {
        const meta: VaultMetadata = {
          version: 1,
          kdf: {
            algorithm: 'PBKDF2',
            iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
            saltHex: salt.toString('hex'),
            digest: CRYPTO_CONFIG.DIGEST
          },
          cipher: CRYPTO_CONFIG.CIPHER,
          createdAt: new Date().toISOString(),
          lastUnlockedAt: new Date().toISOString()
        };
        fs.mkdirSync(path.dirname(effectiveMetaPath), { recursive: true });
        fs.writeFileSync(effectiveMetaPath, JSON.stringify(meta, null, 2), 'utf8');
      }

      report.success = true;
      report.message = 'Migration completed successfully with 100% record and financial parity.';
    }

    return report;
  } catch (err: unknown) {
    if (db) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // ignore rollback error if not in transaction
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    report.success = false;
    report.error = message;
    report.message = `Migration aborted: ${message}`;
    throw new Error(report.message);
  } finally {
    if (db) {
      try {
        db.close();
      } catch {}
    }
    wipeBuffer(keyBuffer);
    if (dryRunTempDir && fs.existsSync(dryRunTempDir)) {
      try {
        fs.rmSync(dryRunTempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
