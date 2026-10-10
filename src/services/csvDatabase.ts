// ============================================================================
// Fixed Database Structure for V1 — CSV ONLY Persistence Engine
// Tables: family_members.csv, assets.csv, fds.csv, post_office.csv, bullions.csv,
//         properties.csv, rents.csv, asset_sales.csv, payments.csv, documents.csv
// ============================================================================

import type {
  FamilyMemberRecord,
  AssetRecord,
  FdRecord,
  PostOfficeRecord,
  BullionRecord,
  PropertyRecord,
  RentRecord,
  AssetSaleRecord,
  PaymentRecord,
  DocumentRecord,
  ContributionRecord
} from '../types';
import { getLocalDateString, isDateOverdue, parseLocalDate } from '../utils/dateUtils';

export type {
  FamilyMemberRecord,
  AssetRecord,
  FdRecord,
  PostOfficeRecord,
  BullionRecord,
  PropertyRecord,
  RentRecord,
  AssetSaleRecord,
  PaymentRecord,
  DocumentRecord,
  ContributionRecord
};

// 1. family_members.csv columns
export const FAMILY_MEMBERS_COLUMNS: (keyof FamilyMemberRecord)[] = [
  'member_id',
  'member_name'
];

// 2. assets.csv columns
export const ASSETS_COLUMNS: (keyof AssetRecord)[] = [
  'a_id',
  'member_id',
  'asset_type',
  'asset_name',
  'asset_status'
];

// 3. fds.csv columns
export const FDS_COLUMNS: (keyof FdRecord)[] = [
  'fd_id',
  'a_id',
  'bank_name',
  'acc_number',
  'principal',
  'interest_rate',
  'start_date',
  'maturity_date',
  'actual_end_date'
];

// 4. post_office.csv columns
export const POST_OFFICE_COLUMNS: (keyof PostOfficeRecord)[] = [
  'po_id',
  'a_id',
  'scheme_name',
  'account_number',
  'principal',
  'interest_rate',
  'start_date',
  'maturity_date',
  'actual_end_date',
  'scheme_status'
];

// 5. bullions.csv columns
export const BULLIONS_COLUMNS: (keyof BullionRecord)[] = [
  'b_id',
  'a_id',
  'b_type',
  'purchase_value',
  'purchase_date',
  'b_status',
  'payment_due_date',
  'weight',
  'weight_unit',
  'purchase_rate',
  'weight_display'
];

// 6. properties.csv columns
export const PROPERTIES_COLUMNS: (keyof PropertyRecord)[] = [
  'p_id',
  'a_id',
  'p_type',
  'name',
  'location',
  'area_sqft',
  'area_unit',
  'purchase_price',
  'party_name',
  'party_contact',
  'purchase_date',
  'p_notes',
  'payment_deadline'
];

// 7. rents.csv columns
export const RENTS_COLUMNS: (keyof RentRecord)[] = [
  'r_id',
  'p_id',
  'tenant_name',
  'tenant_contact',
  'rent_amount',
  'rent_start_date',
  'rent_end_date',
  'next_rent_due',
  'r_notes'
];

// 8. asset_sales.csv columns
export const ASSET_SALES_COLUMNS: (keyof AssetSaleRecord)[] = [
  'sale_id',
  'a_id',
  'buyer_name',
  'buyer_contact',
  'sale_price',
  'sale_date',
  'payment_due_date',
  'sale_notes'
];

// 9. payments.csv columns
export const PAYMENTS_COLUMNS: (keyof PaymentRecord)[] = [
  'payment_id',
  'a_id',
  'payment_type',
  'payment_context',
  'amount',
  'payment_date',
  'due_date',
  'status',
  'notes'
];

// 10. documents.csv columns
export const DOCUMENTS_COLUMNS: (keyof DocumentRecord)[] = [
  'd_id',
  'a_id',
  'r_id',
  'd_category',
  'd_name',
  'd_link'
];

// 11. contributions.csv columns
export const CONTRIBUTIONS_COLUMNS: (keyof ContributionRecord)[] = [
  'contribution_id',
  'a_id',
  'contribution_type',
  'amount',
  'frequency',
  'due_date',
  'payment_date',
  'status',
  'notes'
];

// Numeric fields for type-safe parsing
const NUMBER_FIELDS = new Set([
  'purchase_price',
  'rent_amount',
  'amount',
  'principal',
  'interest_rate',
  'interest',
  'purchase_value',
  'sale_price',
  'weight',
  'purchase_rate'
]);

// ============================================================================
// Robust RFC-4180 CSV Parser & Serializer
// ============================================================================

export function parseCsv<T>(csvText: string, expectedColumns: (keyof T)[]): T[] {
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
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip CR in CRLF
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

  const rawHeaders = splitCsvLine(lines[0]);
  const headers = rawHeaders.map((h) => h.trim().replace(/^"|"$/g, '')) as (keyof T)[];

  const results: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawFields = splitCsvLine(lines[i]);
    if (rawFields.length === 0 || (rawFields.length === 1 && !rawFields[0].trim())) {
      continue;
    }

    const rowObj: Partial<T> = {};
    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c];
      let val = rawFields[c] !== undefined ? rawFields[c].trim() : '';

      // Unquote escaped value
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }

      if (colName === 'principal' && val === '') {
        (rowObj as Record<string, unknown>)[colName as string] = '';
      } else if (NUMBER_FIELDS.has(colName as string)) {
        (rowObj as Record<string, unknown>)[colName as string] = val === '' ? 0 : Number(val) || 0;
      } else {
        (rowObj as Record<string, unknown>)[colName as string] = val;
      }
    }

    // Fill missing expected columns with default empty values
    for (const exp of expectedColumns) {
      if ((rowObj as Record<string, unknown>)[exp as string] === undefined) {
        if (NUMBER_FIELDS.has(exp as string)) {
          (rowObj as Record<string, unknown>)[exp as string] = 0;
        } else {
          (rowObj as Record<string, unknown>)[exp as string] = '';
        }
      }
    }

    results.push(rowObj as T);
  }

  return results;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField);
  return fields;
}

export function serializeCsv<T>(data: T[], columns: (keyof T)[]): string {
  const headerRow = columns.join(',');
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const val = (item as Record<string, unknown>)[col as string];
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',');
  });

  return [headerRow, ...rows].join('\n') + '\n';
}

// ============================================================================
// Default Clean CSV Headers (Zero Records)
// ============================================================================

export const DEFAULT_FAMILY_MEMBERS_CSV = `member_id,member_name\n`;
export const DEFAULT_ASSETS_CSV = `a_id,member_id,asset_type,asset_name,asset_status\n`;
export const DEFAULT_FDS_CSV = `fd_id,a_id,bank_name,acc_number,principal,interest_rate,start_date,maturity_date,actual_end_date\n`;
export const DEFAULT_POST_OFFICE_CSV = `po_id,a_id,scheme_name,account_number,principal,interest_rate,start_date,maturity_date,actual_end_date,scheme_status\n`;
export const DEFAULT_BULLIONS_CSV = `b_id,a_id,b_type,purchase_value,purchase_date,b_status\n`;
export const DEFAULT_PROPERTIES_CSV = `p_id,a_id,p_type,name,location,area_sqft,area_unit,purchase_price,party_name,party_contact,purchase_date,p_notes,payment_deadline\n`;
export const DEFAULT_RENTS_CSV = `r_id,p_id,tenant_name,tenant_contact,rent_amount,rent_start_date,rent_end_date,next_rent_due,r_notes\n`;
export const DEFAULT_ASSET_SALES_CSV = `sale_id,a_id,buyer_name,buyer_contact,sale_price,sale_date,payment_due_date,sale_notes\n`;
export const DEFAULT_PAYMENTS_CSV = `payment_id,a_id,payment_type,payment_context,amount,payment_date,due_date,status,notes\n`;
export const DEFAULT_DOCUMENTS_CSV = `d_id,a_id,r_id,d_category,d_name,d_link\n`;
export const DEFAULT_CONTRIBUTIONS_CSV = `contribution_id,a_id,contribution_type,amount,frequency,due_date,payment_date,status,notes\n`;

// ============================================================================
// CSV Database Engine (Single Source of Truth)
// ============================================================================

export class CsvDatabaseService {
  private static instance: CsvDatabaseService;

  public familyMembers: FamilyMemberRecord[] = [];
  public assets: AssetRecord[] = [];
  public fds: FdRecord[] = [];
  public postOffice: PostOfficeRecord[] = [];
  public bullions: BullionRecord[] = [];
  public properties: PropertyRecord[] = [];
  public rents: RentRecord[] = [];
  public assetSales: AssetSaleRecord[] = [];
  public payments: PaymentRecord[] = [];
  public documents: DocumentRecord[] = [];
  public contributions: ContributionRecord[] = [];

  public isLoaded = false;

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  public static getInstance(): CsvDatabaseService {
    if (!CsvDatabaseService.instance) {
      CsvDatabaseService.instance = new CsvDatabaseService();
    }
    return CsvDatabaseService.instance;
  }

  // Load all 11 CSV tables from CSV files (via /api/csv/ or /data/*.csv)
  public async loadAll(): Promise<void> {
    const [
      familyMembers,
      assets,
      fds,
      postOffice,
      bullions,
      properties,
      rents,
      assetSales,
      payments,
      documents,
      contributions
    ] = await Promise.all([
      this.fetchOrLoadTable<FamilyMemberRecord>('family_members', DEFAULT_FAMILY_MEMBERS_CSV, FAMILY_MEMBERS_COLUMNS),
      this.fetchOrLoadTable<AssetRecord>('assets', DEFAULT_ASSETS_CSV, ASSETS_COLUMNS),
      this.fetchOrLoadTable<FdRecord>('fds', DEFAULT_FDS_CSV, FDS_COLUMNS),
      this.fetchOrLoadTable<PostOfficeRecord>('post_office', DEFAULT_POST_OFFICE_CSV, POST_OFFICE_COLUMNS),
      this.fetchOrLoadTable<BullionRecord>('bullions', DEFAULT_BULLIONS_CSV, BULLIONS_COLUMNS),
      this.fetchOrLoadTable<PropertyRecord>('properties', DEFAULT_PROPERTIES_CSV, PROPERTIES_COLUMNS),
      this.fetchOrLoadTable<RentRecord>('rents', DEFAULT_RENTS_CSV, RENTS_COLUMNS),
      this.fetchOrLoadTable<AssetSaleRecord>('asset_sales', DEFAULT_ASSET_SALES_CSV, ASSET_SALES_COLUMNS),
      this.fetchOrLoadTable<PaymentRecord>('payments', DEFAULT_PAYMENTS_CSV, PAYMENTS_COLUMNS),
      this.fetchOrLoadTable<DocumentRecord>('documents', DEFAULT_DOCUMENTS_CSV, DOCUMENTS_COLUMNS),
      this.fetchOrLoadTable<ContributionRecord>('contributions', DEFAULT_CONTRIBUTIONS_CSV, CONTRIBUTIONS_COLUMNS)
    ]);

    this.familyMembers = familyMembers;
    this.assets = assets;
    this.fds = fds;
    this.postOffice = postOffice;
    this.bullions = bullions;
    this.properties = properties;
    this.rents = rents;
    this.assetSales = assetSales;
    this.payments = payments;
    this.documents = documents;
    this.contributions = contributions;
    this.isLoaded = true;
  }

  private async fetchOrLoadTable<T>(
    tableName: string,
    defaultCsv: string,
    columns: (keyof T)[]
  ): Promise<T[]> {
    let csvContent: string | null = null;

    try {
      // Read directly from /api/csv/ endpoint (authoritative data/ folder)
      const res = await fetch(`/api/csv/${tableName}`);
      if (res.ok) {
        csvContent = await res.text();
      }
    } catch {
      // ignore
    }

    if (!csvContent) {
      // Fallback to default clean header CSV
      csvContent = defaultCsv;
    }

    return parseCsv<T>(csvContent, columns);
  }

  public async persistTable<T>(tableName: string, records: T[], columns: (keyof T)[]): Promise<void> {
    const csvString = serializeCsv<T>(records, columns);

    try {
      await fetch(`/api/csv/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        body: csvString
      });
    } catch (e) {
      console.warn(`Failed to sync ${tableName}.csv to disk:`, e);
    }
  }

  // Clear all 11 tables to clean zero-record state
  public async clearAll(): Promise<void> {
    this.familyMembers = [];
    this.assets = [];
    this.fds = [];
    this.postOffice = [];
    this.bullions = [];
    this.properties = [];
    this.rents = [];
    this.assetSales = [];
    this.payments = [];
    this.documents = [];
    this.contributions = [];

    await Promise.all([
      this.persistTable('family_members', [], FAMILY_MEMBERS_COLUMNS),
      this.persistTable('assets', [], ASSETS_COLUMNS),
      this.persistTable('fds', [], FDS_COLUMNS),
      this.persistTable('post_office', [], POST_OFFICE_COLUMNS),
      this.persistTable('bullions', [], BULLIONS_COLUMNS),
      this.persistTable('properties', [], PROPERTIES_COLUMNS),
      this.persistTable('rents', [], RENTS_COLUMNS),
      this.persistTable('asset_sales', [], ASSET_SALES_COLUMNS),
      this.persistTable('payments', [], PAYMENTS_COLUMNS),
      this.persistTable('documents', [], DOCUMENTS_COLUMNS),
      this.persistTable('contributions', [], CONTRIBUTIONS_COLUMNS)
    ]);
  }

  // ============================================================================
  // Family Members CRUD
  // ============================================================================

  public async addFamilyMember(member: FamilyMemberRecord): Promise<void> {
    this.familyMembers = [...this.familyMembers, member];
    await this.persistTable('family_members', this.familyMembers, FAMILY_MEMBERS_COLUMNS);
  }

  public async deleteFamilyMember(member_id: string): Promise<void> {
    this.familyMembers = this.familyMembers.filter((m) => m.member_id !== member_id);
    await this.persistTable('family_members', this.familyMembers, FAMILY_MEMBERS_COLUMNS);
  }

  // ============================================================================
  // Assets CRUD (assets.csv)
  // ============================================================================

  public async addAsset(asset: AssetRecord): Promise<void> {
    this.assets = [asset, ...this.assets];
    await this.persistTable('assets', this.assets, ASSETS_COLUMNS);
  }

  public async updateAsset(a_id: string, updates: Partial<AssetRecord>): Promise<void> {
    this.assets = this.assets.map((a) => {
      if (a.a_id !== a_id) return a;
      return { ...a, ...updates };
    });
    await this.persistTable('assets', this.assets, ASSETS_COLUMNS);
  }

  public async deleteAsset(a_id: string): Promise<void> {
    this.assets = this.assets.map((a) => {
      if (a.a_id !== a_id) return a;
      return { ...a, asset_status: 'DELETED' as const };
    });
    await this.persistTable('assets', this.assets, ASSETS_COLUMNS);
  }

  // ============================================================================
  // Properties CRUD (properties.csv)
  // ============================================================================

  public async addProperty(prop: PropertyRecord): Promise<void> {
    this.properties = [prop, ...this.properties];
    await this.persistTable('properties', this.properties, PROPERTIES_COLUMNS);
  }

  public async updateProperty(p_id: string, updates: Partial<PropertyRecord>): Promise<void> {
    this.properties = this.properties.map((p) => {
      if (p.p_id !== p_id) return p;
      return { ...p, ...updates };
    });
    await this.persistTable('properties', this.properties, PROPERTIES_COLUMNS);
  }

  public async deleteProperty(p_id: string): Promise<void> {
    const prop = this.properties.find((p) => p.p_id === p_id);
    if (prop) {
      await this.updateAsset(prop.a_id, { asset_status: 'DELETED' });
    }
  }

  // ============================================================================
  // Rents CRUD (rents.csv)
  // ============================================================================

  public async addRent(rent: RentRecord): Promise<void> {
    this.rents = [rent, ...this.rents];
    await this.persistTable('rents', this.rents, RENTS_COLUMNS);
  }

  public async updateRent(r_id: string, updates: Partial<RentRecord>): Promise<void> {
    this.rents = this.rents.map((r) => {
      if (r.r_id !== r_id) return r;
      return { ...r, ...updates };
    });
    await this.persistTable('rents', this.rents, RENTS_COLUMNS);
  }

  public async deleteRent(r_id: string): Promise<void> {
    this.rents = this.rents.filter((r) => r.r_id !== r_id);
    await this.persistTable('rents', this.rents, RENTS_COLUMNS);
  }

  // ============================================================================
  // Asset Sales CRUD (asset_sales.csv)
  // ============================================================================

  public async addAssetSale(sale: AssetSaleRecord): Promise<void> {
    this.assetSales = [sale, ...this.assetSales];
    await this.persistTable('asset_sales', this.assetSales, ASSET_SALES_COLUMNS);
  }

  public async updateAssetSale(sale_id: string, updates: Partial<AssetSaleRecord>): Promise<void> {
    this.assetSales = this.assetSales.map((s) => {
      if (s.sale_id !== sale_id) return s;
      return { ...s, ...updates };
    });
    await this.persistTable('asset_sales', this.assetSales, ASSET_SALES_COLUMNS);
  }

  // ============================================================================
  // Payments CRUD (payments.csv)
  // ============================================================================

  public async addPayment(payment: PaymentRecord): Promise<void> {
    this.payments = [payment, ...this.payments];
    await this.persistTable('payments', this.payments, PAYMENTS_COLUMNS);
  }

  public async addPayments(payments: PaymentRecord[]): Promise<void> {
    this.payments = [...payments, ...this.payments];
    await this.persistTable('payments', this.payments, PAYMENTS_COLUMNS);
  }

  public async updatePayment(payment_id: string, updates: Partial<PaymentRecord>): Promise<void> {
    this.payments = this.payments.map((p) => {
      if (p.payment_id !== payment_id) return p;
      return { ...p, ...updates };
    });
    await this.persistTable('payments', this.payments, PAYMENTS_COLUMNS);
  }

  public async deletePayment(payment_id: string): Promise<void> {
    this.payments = this.payments.filter((p) => p.payment_id !== payment_id);
    await this.persistTable('payments', this.payments, PAYMENTS_COLUMNS);
  }

  // ============================================================================
  // Documents CRUD (documents.csv)
  // ============================================================================

  public async addDocument(doc: DocumentRecord): Promise<void> {
    this.documents = [doc, ...this.documents];
    await this.persistTable('documents', this.documents, DOCUMENTS_COLUMNS);
  }

  public async addDocuments(docs: DocumentRecord[]): Promise<void> {
    this.documents = [...docs, ...this.documents];
    await this.persistTable('documents', this.documents, DOCUMENTS_COLUMNS);
  }

  public async deleteDocument(d_id: string): Promise<void> {
    this.documents = this.documents.filter((d) => d.d_id !== d_id);
    await this.persistTable('documents', this.documents, DOCUMENTS_COLUMNS);
  }

  // ============================================================================
  // FDs CRUD (fds.csv)
  // ============================================================================

  public async addFd(fd: FdRecord): Promise<void> {
    this.fds = [fd, ...this.fds];
    await this.persistTable('fds', this.fds, FDS_COLUMNS);
  }

  public async updateFd(fd_id: string, updates: Partial<FdRecord>): Promise<void> {
    this.fds = this.fds.map((f) => {
      if (f.fd_id !== fd_id) return f;
      return { ...f, ...updates };
    });
    await this.persistTable('fds', this.fds, FDS_COLUMNS);
  }

  public async deleteFd(fd_id: string): Promise<void> {
    const fd = this.fds.find((f) => f.fd_id === fd_id);
    this.fds = this.fds.filter((f) => f.fd_id !== fd_id);
    await this.persistTable('fds', this.fds, FDS_COLUMNS);

    if (fd) {
      await this.updateAsset(fd.a_id, { asset_status: 'DELETED' });
    }
  }

  // ============================================================================
  // Post Office CRUD (post_office.csv)
  // ============================================================================

  public async addPostOffice(po: PostOfficeRecord): Promise<void> {
    this.postOffice = [po, ...this.postOffice];
    await this.persistTable('post_office', this.postOffice, POST_OFFICE_COLUMNS);
  }

  public async updatePostOffice(po_id: string, updates: Partial<PostOfficeRecord>): Promise<void> {
    this.postOffice = this.postOffice.map((p) => {
      if (p.po_id !== po_id) return p;
      return { ...p, ...updates };
    });
    await this.persistTable('post_office', this.postOffice, POST_OFFICE_COLUMNS);
  }

  public async deletePostOffice(po_id: string): Promise<void> {
    const po = this.postOffice.find((p) => p.po_id === po_id);
    this.postOffice = this.postOffice.filter((p) => p.po_id !== po_id);
    await this.persistTable('post_office', this.postOffice, POST_OFFICE_COLUMNS);

    if (po) {
      await this.updateAsset(po.a_id, { asset_status: 'DELETED' });
    }
  }

  // ============================================================================
  // Bullions CRUD (bullions.csv)
  // ============================================================================

  public async addBullion(bul: BullionRecord): Promise<void> {
    this.bullions = [bul, ...this.bullions];
    await this.persistTable('bullions', this.bullions, BULLIONS_COLUMNS);
  }

  public async updateBullion(b_id: string, updates: Partial<BullionRecord>): Promise<void> {
    this.bullions = this.bullions.map((b) => {
      if (b.b_id !== b_id) return b;
      return { ...b, ...updates };
    });
    await this.persistTable('bullions', this.bullions, BULLIONS_COLUMNS);
  }

  public async deleteBullion(b_id: string): Promise<void> {
    const bul = this.bullions.find((b) => b.b_id === b_id);
    this.bullions = this.bullions.filter((b) => b.b_id !== b_id);
    await this.persistTable('bullions', this.bullions, BULLIONS_COLUMNS);

    if (bul) {
      await this.updateAsset(bul.a_id, { asset_status: 'DELETED' });
    }
  }

  // ============================================================================
  // Derived Calculations (Section 4 Requirements)
  // ============================================================================

  public calculatePropertyFinances(p_id: string, referenceDate: Date = new Date()) {
    const prop = this.properties.find((p) => p.p_id === p_id);
    const asset = prop ? this.assets.find((a) => a.a_id === prop.a_id) : undefined;
    const a_id = prop?.a_id || '';

    const purchasePrice = prop ? Number(prop.purchase_price) || 0 : 0;
    const purchasePayments = this.payments.filter(
      (p) => p.a_id === a_id && p.payment_type === 'PURCHASE' && (p.status === 'PAID' || p.status === 'RECEIVED')
    );
    const totalPurchasePaid = purchasePayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    // Remaining purchase amount dynamically calculated: purchase_price - total PURCHASE payments
    const paymentLeft = Math.max(0, purchasePrice - totalPurchasePaid);

    // Sales calculation from asset_sales.csv and payments.csv
    const sale = this.assetSales.find((s) => s.a_id === a_id);
    const salePrice = sale ? Number(sale.sale_price) || 0 : 0;

    const salePayments = this.payments.filter(
      (p) =>
        p.a_id === a_id &&
        p.payment_type === 'RECEIVED' &&
        p.payment_context === 'SALE' &&
        (p.status === 'RECEIVED' || p.status === 'PAID')
    );
    const totalSaleReceived = salePayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    const saleReceivableLeft = Math.max(0, salePrice - totalSaleReceived);

    const pendingPayments = this.payments.filter(
      (p) => p.a_id === a_id && (p.status === 'PENDING' || p.status === 'OVERDUE') && p.due_date
    );

    pendingPayments.sort(
      (a, b) => (parseLocalDate(a.due_date)?.getTime() || 0) - (parseLocalDate(b.due_date)?.getTime() || 0)
    );

    const isSold = asset?.asset_status === 'SOLD';
    let nextDueDate = pendingPayments[0]?.due_date;
    if (isSold && !nextDueDate && sale?.payment_due_date && saleReceivableLeft > 0) {
      nextDueDate = sale.payment_due_date;
    }

    const isOverdue = nextDueDate ? isDateOverdue(nextDueDate, referenceDate) : false;

    let paymentStatus: 'completed' | 'pending' | 'missed' = 'completed';

    if (isSold) {
      if (saleReceivableLeft > 0) {
        paymentStatus = isOverdue ? 'missed' : 'pending';
      } else {
        paymentStatus = 'completed';
      }
    } else {
      if (paymentLeft > 0) {
        paymentStatus = isOverdue ? 'missed' : 'pending';
      } else {
        paymentStatus = 'completed';
      }
    }

    return {
      purchasePrice,
      totalPurchasePaid,
      paymentLeft,
      salePrice,
      totalSaleReceived,
      saleReceivableLeft,
      nextDueDate,
      paymentStatus
    };
  }

  // Active rent: rent where rent_end_date is empty or in future
  public getActiveRentForProperty(p_id: string, referenceDate: Date = new Date()): RentRecord | undefined {
    const today = getLocalDateString(referenceDate);
    const rentsForProp = this.rents.filter((r) => r.p_id === p_id);
    return rentsForProp.find((r) => !r.rent_end_date || r.rent_end_date >= today);
  }

  public getDocumentsForAsset(a_id: string): DocumentRecord[] {
    return this.documents.filter((d) => d.a_id === a_id);
  }

  public getDocumentsForProperty(p_id: string): DocumentRecord[] {
    const prop = this.properties.find((p) => p.p_id === p_id);
    if (!prop) return [];
    return this.documents.filter((d) => d.a_id === prop.a_id || d.p_id === p_id);
  }

  public getDocumentsForRent(p_id: string, r_id?: string): DocumentRecord[] {
    const prop = this.properties.find((p) => p.p_id === p_id);
    const a_id = prop?.a_id;
    return this.documents.filter(
      (d) =>
        (a_id && d.a_id === a_id && d.d_category === 'RENT') ||
        (r_id && d.r_id === r_id)
    );
  }

  public getDocumentsForFd(fd_id: string): DocumentRecord[] {
    const fd = this.fds.find((f) => f.fd_id === fd_id);
    const a_id = fd?.a_id;
    return this.documents.filter((d) => (a_id && d.a_id === a_id) || d.fd_id === fd_id);
  }

  // ============================================================================
  // Contributions CRUD (contributions.csv)
  // ============================================================================

  public async addContribution(contribution: ContributionRecord): Promise<void> {
    this.contributions = [...this.contributions, contribution];
    await this.persistTable('contributions', this.contributions, CONTRIBUTIONS_COLUMNS);
  }

  public async addContributions(records: ContributionRecord[]): Promise<void> {
    this.contributions = [...this.contributions, ...records];
    await this.persistTable('contributions', this.contributions, CONTRIBUTIONS_COLUMNS);
  }

  public async updateContribution(contribution_id: string, updates: Partial<ContributionRecord>): Promise<void> {
    this.contributions = this.contributions.map((c) =>
      c.contribution_id === contribution_id ? { ...c, ...updates } : c
    );
    await this.persistTable('contributions', this.contributions, CONTRIBUTIONS_COLUMNS);
  }

  public async deleteContribution(contribution_id: string): Promise<void> {
    this.contributions = this.contributions.filter((c) => c.contribution_id !== contribution_id);
    await this.persistTable('contributions', this.contributions, CONTRIBUTIONS_COLUMNS);
  }

  public async deleteContributionsForAsset(a_id: string): Promise<void> {
    this.contributions = this.contributions.filter((c) => c.a_id !== a_id);
    await this.persistTable('contributions', this.contributions, CONTRIBUTIONS_COLUMNS);
  }

  public getContributionsForAsset(a_id: string): ContributionRecord[] {
    return this.contributions.filter((c) => c.a_id === a_id);
  }
}

export const csvDb = CsvDatabaseService.getInstance();
