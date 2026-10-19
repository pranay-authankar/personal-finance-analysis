import fs from 'node:fs';
import path from 'node:path';
import type {
  ParsedCsvDataset,
  ValidationError,
  TableReconciliation
} from './types.ts';

export interface ValidationSummary {
  isValid: boolean;
  tableMetrics: Record<string, TableReconciliation>;
  errors: ValidationError[];
  warnings: ValidationError[];
  missingDocuments: string[];
  unreferencedUploads: string[];
  sourceFinancials: Record<string, number>;
  validDataset: ParsedCsvDataset;
}

const VALID_ASSET_TYPES = new Set(['FD', 'POST_OFFICE', 'BULLION', 'REAL_ESTATE']);
const VALID_ASSET_STATUSES = new Set(['ACTIVE', 'SOLD', 'MATURED', 'REDEEMED', 'CLOSED', 'DELETED']);
const VALID_PAYMENT_TYPES = new Set(['PURCHASE', 'RECEIVED', 'DEBIT', 'CREDIT']);
const VALID_PAYMENT_CONTEXTS = new Set(['PURCHASE', 'SALE', 'MATURITY', 'RENT', 'OTHER']);
const VALID_PAYMENT_STATUSES = new Set(['PAID', 'PENDING', 'OVERDUE', 'RECEIVED', 'MISSED', 'CANCELLED', 'COMPLETED']);
const VALID_CONTRIBUTION_STATUSES = new Set(['PAID', 'PENDING', 'MISSED', 'DEFAULTED', 'CANCELLED', 'COMPLETED']);

/**
 * Validates the entire parsed CSV dataset against relational integrity,
 * primary key uniqueness, data formats, and document references.
 */
export function validateDataset(
  dataset: ParsedCsvDataset,
  uploadsDir?: string
): ValidationSummary {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const tableMetrics: Record<string, TableReconciliation> = {};

  // Track valid IDs for foreign-key resolution
  const validMemberIds = new Set<string>();
  const validAssetIds = new Set<string>();
  const validPropertyIds = new Set<string>();
  const validRentIds = new Set<string>();

  const validDataset: ParsedCsvDataset = {
    family_members: [],
    assets: [],
    fds: [],
    post_office: [],
    bullions: [],
    properties: [],
    rents: [],
    asset_sales: [],
    payments: [],
    documents: [],
    contributions: [],
    fileHashes: { ...dataset.fileHashes }
  };

  // Helper to initialize table metrics
  const initTableMetrics = (tableName: string, totalRows: number) => {
    tableMetrics[tableName] = {
      sourceRows: totalRows,
      validRows: 0,
      rejectedRows: 0,
      warningsCount: 0,
      importedRows: 0,
      status: 'MATCHED'
    };
  };

  // ---------------------------------------------------------------------------
  // 1. Family Members
  // ---------------------------------------------------------------------------
  const fmRows = dataset.family_members;
  initTableMetrics('family_members', fmRows.length);
  const seenMemberIds = new Set<string>();

  for (let idx = 0; idx < fmRows.length; idx++) {
    const row = fmRows[idx];
    const rowNum = idx + 2; // header is line 1
    const id = (row.member_id || '').trim();
    const name = (row.member_name || '').trim();

    if (!id) {
      errors.push({
        table: 'family_members',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'member_id',
        message: 'Primary key member_id is missing or empty.',
        severity: 'ERROR'
      });
      tableMetrics.family_members.rejectedRows++;
      continue;
    }

    if (seenMemberIds.has(id)) {
      errors.push({
        table: 'family_members',
        rowNumber: rowNum,
        id,
        field: 'member_id',
        message: `Duplicate primary key member_id "${id}".`,
        severity: 'ERROR'
      });
      tableMetrics.family_members.rejectedRows++;
      continue;
    }

    if (!name) {
      warnings.push({
        table: 'family_members',
        rowNumber: rowNum,
        id,
        field: 'member_name',
        message: 'Family member name is empty.',
        severity: 'WARNING'
      });
      tableMetrics.family_members.warningsCount++;
    }

    seenMemberIds.add(id);
    validMemberIds.add(id);
    validDataset.family_members.push(row);
    tableMetrics.family_members.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 2. Assets (Root of all investment items)
  // ---------------------------------------------------------------------------
  const assetRows = dataset.assets;
  initTableMetrics('assets', assetRows.length);
  const seenAssetIds = new Set<string>();

  for (let idx = 0; idx < assetRows.length; idx++) {
    const row = assetRows[idx];
    const rowNum = idx + 2;
    const id = (row.a_id || '').trim();
    const memberId = (row.member_id || '').trim();
    const assetType = (row.asset_type || '').trim().toUpperCase();
    const assetStatus = (row.asset_status || 'ACTIVE').trim().toUpperCase();

    if (!id) {
      errors.push({
        table: 'assets',
        rowNumber: rowNum,
        id: `row_${rowNum}`,
        field: 'a_id',
        message: 'Primary key a_id is missing or empty.',
        severity: 'ERROR'
      });
      tableMetrics.assets.rejectedRows++;
      continue;
    }

    if (seenAssetIds.has(id)) {
      errors.push({
        table: 'assets',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Duplicate primary key a_id "${id}".`,
        severity: 'ERROR'
      });
      tableMetrics.assets.rejectedRows++;
      continue;
    }

    if (!validMemberIds.has(memberId)) {
      errors.push({
        table: 'assets',
        rowNumber: rowNum,
        id,
        field: 'member_id',
        message: `Orphan asset: member_id "${memberId}" does not exist in family_members.`,
        severity: 'ERROR'
      });
      tableMetrics.assets.rejectedRows++;
      continue;
    }

    if (!VALID_ASSET_TYPES.has(assetType)) {
      errors.push({
        table: 'assets',
        rowNumber: rowNum,
        id,
        field: 'asset_type',
        message: `Invalid asset_type "${assetType}". Expected FD, POST_OFFICE, BULLION, or REAL_ESTATE.`,
        severity: 'ERROR'
      });
      tableMetrics.assets.rejectedRows++;
      continue;
    }

    if (!VALID_ASSET_STATUSES.has(assetStatus)) {
      warnings.push({
        table: 'assets',
        rowNumber: rowNum,
        id,
        field: 'asset_status',
        message: `Unknown asset_status "${assetStatus}". Defaulting to ACTIVE.`,
        severity: 'WARNING'
      });
      tableMetrics.assets.warningsCount++;
    }

    seenAssetIds.add(id);
    validAssetIds.add(id);
    validDataset.assets.push(row);
    tableMetrics.assets.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 3. Fixed Deposits (fds)
  // ---------------------------------------------------------------------------
  const fdRows = dataset.fds;
  initTableMetrics('fds', fdRows.length);
  const seenFdIds = new Set<string>();
  const seenFdAssetIds = new Set<string>();

  for (let idx = 0; idx < fdRows.length; idx++) {
    const row = fdRows[idx];
    const rowNum = idx + 2;
    const id = (row.fd_id || '').trim();
    const aId = (row.a_id || '').trim();

    if (!id || seenFdIds.has(id)) {
      errors.push({
        table: 'fds',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'fd_id',
        message: seenFdIds.has(id) ? `Duplicate fd_id "${id}"` : 'Missing fd_id',
        severity: 'ERROR'
      });
      tableMetrics.fds.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'fds',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan FD: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.fds.rejectedRows++;
      continue;
    }

    if (seenFdAssetIds.has(aId)) {
      errors.push({
        table: 'fds',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Duplicate asset link: a_id "${aId}" already mapped to an FD.`,
        severity: 'ERROR'
      });
      tableMetrics.fds.rejectedRows++;
      continue;
    }

    const principal = Number(row.principal);
    if (isNaN(principal) || principal < 0) {
      errors.push({
        table: 'fds',
        rowNumber: rowNum,
        id,
        field: 'principal',
        message: `Invalid principal numeric value: "${row.principal}".`,
        severity: 'ERROR'
      });
      tableMetrics.fds.rejectedRows++;
      continue;
    }

    seenFdIds.add(id);
    seenFdAssetIds.add(aId);
    validDataset.fds.push(row);
    tableMetrics.fds.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 4. Post Office Schemes
  // ---------------------------------------------------------------------------
  const poRows = dataset.post_office;
  initTableMetrics('post_office', poRows.length);
  const seenPoIds = new Set<string>();
  const seenPoAssetIds = new Set<string>();

  for (let idx = 0; idx < poRows.length; idx++) {
    const row = poRows[idx];
    const rowNum = idx + 2;
    const id = (row.po_id || '').trim();
    const aId = (row.a_id || '').trim();

    if (!id || seenPoIds.has(id)) {
      errors.push({
        table: 'post_office',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'po_id',
        message: seenPoIds.has(id) ? `Duplicate po_id "${id}"` : 'Missing po_id',
        severity: 'ERROR'
      });
      tableMetrics.post_office.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'post_office',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan Post Office investment: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.post_office.rejectedRows++;
      continue;
    }

    if (seenPoAssetIds.has(aId)) {
      errors.push({
        table: 'post_office',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Duplicate asset link: a_id "${aId}" already mapped to a Post Office account.`,
        severity: 'ERROR'
      });
      tableMetrics.post_office.rejectedRows++;
      continue;
    }

    seenPoIds.add(id);
    seenPoAssetIds.add(aId);
    validDataset.post_office.push(row);
    tableMetrics.post_office.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 5. Bullions
  // ---------------------------------------------------------------------------
  const bulRows = dataset.bullions;
  initTableMetrics('bullions', bulRows.length);
  const seenBulIds = new Set<string>();
  const seenBulAssetIds = new Set<string>();

  for (let idx = 0; idx < bulRows.length; idx++) {
    const row = bulRows[idx];
    const rowNum = idx + 2;
    const id = (row.b_id || '').trim();
    const aId = (row.a_id || '').trim();

    if (!id || seenBulIds.has(id)) {
      errors.push({
        table: 'bullions',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'b_id',
        message: seenBulIds.has(id) ? `Duplicate b_id "${id}"` : 'Missing b_id',
        severity: 'ERROR'
      });
      tableMetrics.bullions.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'bullions',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan bullion: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.bullions.rejectedRows++;
      continue;
    }

    if (seenBulAssetIds.has(aId)) {
      errors.push({
        table: 'bullions',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Duplicate asset link: a_id "${aId}" already mapped to a bullion record.`,
        severity: 'ERROR'
      });
      tableMetrics.bullions.rejectedRows++;
      continue;
    }

    const val = Number(row.purchase_value);
    if (isNaN(val) || val < 0) {
      errors.push({
        table: 'bullions',
        rowNumber: rowNum,
        id,
        field: 'purchase_value',
        message: `Invalid purchase_value: "${row.purchase_value}".`,
        severity: 'ERROR'
      });
      tableMetrics.bullions.rejectedRows++;
      continue;
    }

    seenBulIds.add(id);
    seenBulAssetIds.add(aId);
    validDataset.bullions.push(row);
    tableMetrics.bullions.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 6. Properties
  // ---------------------------------------------------------------------------
  const propRows = dataset.properties;
  initTableMetrics('properties', propRows.length);
  const seenPropIds = new Set<string>();
  const seenPropAssetIds = new Set<string>();

  for (let idx = 0; idx < propRows.length; idx++) {
    const row = propRows[idx];
    const rowNum = idx + 2;
    const id = (row.p_id || '').trim();
    const aId = (row.a_id || '').trim();

    if (!id || seenPropIds.has(id)) {
      errors.push({
        table: 'properties',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'p_id',
        message: seenPropIds.has(id) ? `Duplicate p_id "${id}"` : 'Missing p_id',
        severity: 'ERROR'
      });
      tableMetrics.properties.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'properties',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan property: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.properties.rejectedRows++;
      continue;
    }

    if (seenPropAssetIds.has(aId)) {
      errors.push({
        table: 'properties',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Duplicate asset link: a_id "${aId}" already mapped to a property record.`,
        severity: 'ERROR'
      });
      tableMetrics.properties.rejectedRows++;
      continue;
    }

    const price = Number(row.purchase_price);
    if (isNaN(price) || price < 0) {
      errors.push({
        table: 'properties',
        rowNumber: rowNum,
        id,
        field: 'purchase_price',
        message: `Invalid purchase_price: "${row.purchase_price}".`,
        severity: 'ERROR'
      });
      tableMetrics.properties.rejectedRows++;
      continue;
    }

    seenPropIds.add(id);
    seenPropAssetIds.add(aId);
    validPropertyIds.add(id);
    validDataset.properties.push(row);
    tableMetrics.properties.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 7. Rents
  // ---------------------------------------------------------------------------
  const rentRows = dataset.rents;
  initTableMetrics('rents', rentRows.length);
  const seenRentIds = new Set<string>();

  for (let idx = 0; idx < rentRows.length; idx++) {
    const row = rentRows[idx];
    const rowNum = idx + 2;
    const id = (row.r_id || '').trim();
    const pId = (row.p_id || '').trim();

    if (!id || seenRentIds.has(id)) {
      errors.push({
        table: 'rents',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'r_id',
        message: seenRentIds.has(id) ? `Duplicate r_id "${id}"` : 'Missing r_id',
        severity: 'ERROR'
      });
      tableMetrics.rents.rejectedRows++;
      continue;
    }

    if (!validPropertyIds.has(pId)) {
      errors.push({
        table: 'rents',
        rowNumber: rowNum,
        id,
        field: 'p_id',
        message: `Orphan rent lease: p_id "${pId}" does not exist in valid properties.`,
        severity: 'ERROR'
      });
      tableMetrics.rents.rejectedRows++;
      continue;
    }

    const rentAmt = Number(row.rent_amount);
    if (isNaN(rentAmt) || rentAmt < 0) {
      errors.push({
        table: 'rents',
        rowNumber: rowNum,
        id,
        field: 'rent_amount',
        message: `Invalid rent_amount: "${row.rent_amount}".`,
        severity: 'ERROR'
      });
      tableMetrics.rents.rejectedRows++;
      continue;
    }

    seenRentIds.add(id);
    validRentIds.add(id);
    validDataset.rents.push(row);
    tableMetrics.rents.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 8. Asset Sales
  // ---------------------------------------------------------------------------
  const saleRows = dataset.asset_sales;
  initTableMetrics('asset_sales', saleRows.length);
  const seenSaleIds = new Set<string>();

  for (let idx = 0; idx < saleRows.length; idx++) {
    const row = saleRows[idx];
    const rowNum = idx + 2;
    const id = (row.sale_id || '').trim();
    const aId = (row.a_id || '').trim();

    if (!id || seenSaleIds.has(id)) {
      errors.push({
        table: 'asset_sales',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'sale_id',
        message: seenSaleIds.has(id) ? `Duplicate sale_id "${id}"` : 'Missing sale_id',
        severity: 'ERROR'
      });
      tableMetrics.asset_sales.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'asset_sales',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan asset sale: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.asset_sales.rejectedRows++;
      continue;
    }

    seenSaleIds.add(id);
    validDataset.asset_sales.push(row);
    tableMetrics.asset_sales.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 9. Overall Payments
  // ---------------------------------------------------------------------------
  const payRows = dataset.payments;
  initTableMetrics('payments', payRows.length);
  const seenPayIds = new Set<string>();

  for (let idx = 0; idx < payRows.length; idx++) {
    const row = payRows[idx];
    const rowNum = idx + 2;
    const id = (row.payment_id || '').trim();
    const aId = (row.a_id || '').trim();
    const pType = (row.payment_type || 'PURCHASE').trim().toUpperCase();
    const pCtx = (row.payment_context || 'PURCHASE').trim().toUpperCase();
    const status = (row.status || 'PENDING').trim().toUpperCase();

    if (!id || seenPayIds.has(id)) {
      errors.push({
        table: 'payments',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'payment_id',
        message: seenPayIds.has(id) ? `Duplicate payment_id "${id}"` : 'Missing payment_id',
        severity: 'ERROR'
      });
      tableMetrics.payments.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'payments',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan payment: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.payments.rejectedRows++;
      continue;
    }

    const amt = Number(row.amount);
    if (isNaN(amt) || amt < 0) {
      errors.push({
        table: 'payments',
        rowNumber: rowNum,
        id,
        field: 'amount',
        message: `Invalid payment amount: "${row.amount}".`,
        severity: 'ERROR'
      });
      tableMetrics.payments.rejectedRows++;
      continue;
    }

    if (!VALID_PAYMENT_TYPES.has(pType)) {
      warnings.push({
        table: 'payments',
        rowNumber: rowNum,
        id,
        field: 'payment_type',
        message: `Unknown payment_type "${pType}". Normalizing to PURCHASE.`,
        severity: 'WARNING'
      });
      tableMetrics.payments.warningsCount++;
    }

    if (!VALID_PAYMENT_CONTEXTS.has(pCtx)) {
      warnings.push({
        table: 'payments',
        rowNumber: rowNum,
        id,
        field: 'payment_context',
        message: `Unknown payment_context "${pCtx}". Normalizing to OTHER.`,
        severity: 'WARNING'
      });
      tableMetrics.payments.warningsCount++;
    }

    if (!VALID_PAYMENT_STATUSES.has(status)) {
      warnings.push({
        table: 'payments',
        rowNumber: rowNum,
        id,
        field: 'status',
        message: `Unknown payment status "${status}". Normalizing to PENDING.`,
        severity: 'WARNING'
      });
      tableMetrics.payments.warningsCount++;
    }

    seenPayIds.add(id);
    validDataset.payments.push(row);
    tableMetrics.payments.validRows++;
  }

  // ---------------------------------------------------------------------------
  // 10. Documents
  // ---------------------------------------------------------------------------
  const docRows = dataset.documents;
  initTableMetrics('documents', docRows.length);
  const seenDocIds = new Set<string>();
  const missingDocuments: string[] = [];
  const referencedUploadFiles = new Set<string>();

  for (let idx = 0; idx < docRows.length; idx++) {
    const row = docRows[idx];
    const rowNum = idx + 2;
    const id = (row.d_id || '').trim();
    const aId = (row.a_id || '').trim();
    const rId = (row.r_id || '').trim();
    const link = (row.d_link || '').trim();

    if (!id || seenDocIds.has(id)) {
      errors.push({
        table: 'documents',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'd_id',
        message: seenDocIds.has(id) ? `Duplicate d_id "${id}"` : 'Missing d_id',
        severity: 'ERROR'
      });
      tableMetrics.documents.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'documents',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan document: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.documents.rejectedRows++;
      continue;
    }

    if (rId && !validRentIds.has(rId)) {
      warnings.push({
        table: 'documents',
        rowNumber: rowNum,
        id,
        field: 'r_id',
        message: `Document r_id "${rId}" not found in rents. Property link preserved.`,
        severity: 'WARNING'
      });
      tableMetrics.documents.warningsCount++;
    }

    // Check disk attachment reference if uploads directory provided
    if (uploadsDir && link) {
      const cleanFileName = path.basename(link.replace(/^\/api\/uploads\//, '').replace(/^\/uploads\//, ''));
      referencedUploadFiles.add(cleanFileName);
      const fullPath = path.join(uploadsDir, cleanFileName);

      if (!fs.existsSync(fullPath)) {
        missingDocuments.push(cleanFileName);
        warnings.push({
          table: 'documents',
          rowNumber: rowNum,
          id,
          field: 'd_link',
          message: `Referenced upload file "${cleanFileName}" is missing from disk.`,
          severity: 'WARNING'
        });
        tableMetrics.documents.warningsCount++;
      }
    }

    seenDocIds.add(id);
    validDataset.documents.push(row);
    tableMetrics.documents.validRows++;
  }

  // Detect unreferenced files in uploads directory
  const unreferencedUploads: string[] = [];
  if (uploadsDir && fs.existsSync(uploadsDir)) {
    try {
      const diskFiles = fs.readdirSync(uploadsDir);
      for (const file of diskFiles) {
        if (file === '.gitkeep') continue;
        if (!referencedUploadFiles.has(file)) {
          unreferencedUploads.push(file);
        }
      }
    } catch {
      // Ignore directory read error
    }
  }

  // ---------------------------------------------------------------------------
  // 11. Contributions
  // ---------------------------------------------------------------------------
  const cntRows = dataset.contributions;
  initTableMetrics('contributions', cntRows.length);
  const seenCntIds = new Set<string>();

  for (let idx = 0; idx < cntRows.length; idx++) {
    const row = cntRows[idx];
    const rowNum = idx + 2;
    const id = (row.contribution_id || '').trim();
    const aId = (row.a_id || '').trim();
    const status = (row.status || 'PENDING').trim().toUpperCase();

    if (!id || seenCntIds.has(id)) {
      errors.push({
        table: 'contributions',
        rowNumber: rowNum,
        id: id || `row_${rowNum}`,
        field: 'contribution_id',
        message: seenCntIds.has(id) ? `Duplicate contribution_id "${id}"` : 'Missing contribution_id',
        severity: 'ERROR'
      });
      tableMetrics.contributions.rejectedRows++;
      continue;
    }

    if (!validAssetIds.has(aId)) {
      errors.push({
        table: 'contributions',
        rowNumber: rowNum,
        id,
        field: 'a_id',
        message: `Orphan contribution: a_id "${aId}" not found in assets.`,
        severity: 'ERROR'
      });
      tableMetrics.contributions.rejectedRows++;
      continue;
    }

    const amt = Number(row.amount);
    if (isNaN(amt) || amt < 0) {
      errors.push({
        table: 'contributions',
        rowNumber: rowNum,
        id,
        field: 'amount',
        message: `Invalid contribution amount: "${row.amount}".`,
        severity: 'ERROR'
      });
      tableMetrics.contributions.rejectedRows++;
      continue;
    }

    if (!VALID_CONTRIBUTION_STATUSES.has(status)) {
      warnings.push({
        table: 'contributions',
        rowNumber: rowNum,
        id,
        field: 'status',
        message: `Unknown contribution status "${status}". Normalizing to PENDING.`,
        severity: 'WARNING'
      });
      tableMetrics.contributions.warningsCount++;
    }

    seenCntIds.add(id);
    validDataset.contributions.push(row);
    tableMetrics.contributions.validRows++;
  }

  // ---------------------------------------------------------------------------
  // Financial Totals Calculation (Source Baselines)
  // ---------------------------------------------------------------------------
  // 1. FDs
  const sourceFdTotal = validDataset.fds
    .filter((f) => {
      const ast = validDataset.assets.find((a) => a.a_id === f.a_id);
      return (!f.actual_end_date || f.actual_end_date.trim() === '') && ast?.asset_status === 'ACTIVE';
    })
    .reduce((s, f) => s + (Number(f.principal) || 0), 0);

  // 2. Post Office
  let sourcePoTotal = 0;
  for (const po of validDataset.post_office) {
    const ast = validDataset.assets.find((a) => a.a_id === po.a_id);
    if ((!po.actual_end_date || po.actual_end_date.trim() === '') && ast?.asset_status === 'ACTIVE') {
      const sName = (po.scheme_name || '').toLowerCase();
      const isRd = sName.includes('recurring') || sName.includes('(rd)');
      if (isRd) {
        const paidCnt = validDataset.contributions.filter(
          (c) => c.a_id === po.a_id && c.status === 'PAID'
        );
        sourcePoTotal += paidCnt.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      } else {
        sourcePoTotal += Number(po.principal) || 0;
      }
    }
  }

  // 3. Bullions
  const sourceBulTotal = validDataset.bullions
    .filter((b) => {
      const ast = validDataset.assets.find((a) => a.a_id === b.a_id);
      return b.b_status === 'HELD' && ast?.asset_status === 'ACTIVE';
    })
    .reduce((s, b) => s + (Number(b.purchase_value) || 0), 0);

  // 4. Real Estate
  const sourcePropTotal = validDataset.properties
    .filter((p) => {
      const ast = validDataset.assets.find((a) => a.a_id === p.a_id);
      return ast?.asset_status === 'ACTIVE';
    })
    .reduce((s, p) => s + (Number(p.purchase_price) || 0), 0);

  // 5. Realized Funds
  const sourceRealizedTotal = validDataset.payments
    .filter(
      (p) =>
        p.payment_type === 'RECEIVED' &&
        (p.payment_context === 'SALE' || p.payment_context === 'MATURITY') &&
        (p.status === 'RECEIVED' || p.status === 'PAID')
    )
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const sourceNetWorth =
    sourceFdTotal + sourcePoTotal + sourceBulTotal + sourcePropTotal + sourceRealizedTotal;

  const sourceFinancials: Record<string, number> = {
    'Fixed Deposits': sourceFdTotal,
    'Post Office': sourcePoTotal,
    'Bullions': sourceBulTotal,
    'Real Estate': sourcePropTotal,
    'Realized Funds': sourceRealizedTotal,
    'Overall Net Worth': sourceNetWorth
  };

  return {
    isValid: errors.length === 0,
    tableMetrics,
    errors,
    warnings,
    missingDocuments,
    unreferencedUploads,
    sourceFinancials,
    validDataset
  };
}
