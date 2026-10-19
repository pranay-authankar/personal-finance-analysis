/**
 * Canonical Relational Database Schema for FamilyVault.
 * Defines all 11 core financial tables + migration ledger with foreign key constraints,
 * indexes, and cascade behaviors.
 */

export const SCHEMA_SQL = `
-- 1. Family Members Table
CREATE TABLE IF NOT EXISTS family_members (
    member_id TEXT PRIMARY KEY,
    member_name TEXT NOT NULL,
    role TEXT DEFAULT 'Family Member',
    avatar TEXT DEFAULT '🧑',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Assets Table (Central entity for all investment items)
CREATE TABLE IF NOT EXISTS assets (
    a_id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK(asset_type IN ('FD', 'POST_OFFICE', 'BULLION', 'REAL_ESTATE')),
    asset_name TEXT NOT NULL,
    asset_status TEXT NOT NULL CHECK(asset_status IN ('ACTIVE', 'SOLD', 'MATURED', 'REDEEMED', 'CLOSED', 'DELETED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES family_members(member_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_assets_member ON assets(member_id);
CREATE INDEX IF NOT EXISTS idx_assets_type_status ON assets(asset_type, asset_status);

-- 3. Fixed Deposits Table
CREATE TABLE IF NOT EXISTS fds (
    fd_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL UNIQUE,
    bank_name TEXT NOT NULL,
    acc_number TEXT NOT NULL DEFAULT '',
    principal REAL NOT NULL DEFAULT 0,
    interest_rate REAL NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL DEFAULT '',
    maturity_date TEXT NOT NULL DEFAULT '',
    actual_end_date TEXT DEFAULT '',
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fds_aid ON fds(a_id);
CREATE INDEX IF NOT EXISTS idx_fds_maturity ON fds(maturity_date);

-- 4. Post Office Investments Table
CREATE TABLE IF NOT EXISTS post_office (
    po_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL UNIQUE,
    scheme_name TEXT NOT NULL,
    account_number TEXT NOT NULL DEFAULT '',
    principal REAL DEFAULT NULL,
    interest_rate REAL NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL DEFAULT '',
    maturity_date TEXT NOT NULL DEFAULT '',
    actual_end_date TEXT DEFAULT '',
    scheme_status TEXT NOT NULL DEFAULT 'ACTIVE',
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_po_aid ON post_office(a_id);
CREATE INDEX IF NOT EXISTS idx_po_maturity ON post_office(maturity_date);

-- 5. Bullions Table (Preserving all fields: metals, diamonds, stones)
CREATE TABLE IF NOT EXISTS bullions (
    b_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL UNIQUE,
    b_type TEXT NOT NULL,
    purchase_value REAL NOT NULL DEFAULT 0,
    purchase_date TEXT NOT NULL DEFAULT '',
    b_status TEXT NOT NULL DEFAULT 'HELD' CHECK(b_status IN ('HELD', 'SOLD')),
    payment_due_date TEXT DEFAULT '',
    weight REAL DEFAULT 0,
    weight_unit TEXT DEFAULT '',
    purchase_rate REAL DEFAULT 0,
    weight_display TEXT DEFAULT '',
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bullions_aid ON bullions(a_id);

-- 6. Properties Table (Real Estate properties)
CREATE TABLE IF NOT EXISTS properties (
    p_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL UNIQUE,
    p_type TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    area_sqft TEXT DEFAULT '',
    area_unit TEXT DEFAULT '',
    purchase_price REAL NOT NULL DEFAULT 0,
    party_name TEXT DEFAULT '',
    party_contact TEXT DEFAULT '',
    purchase_date TEXT NOT NULL DEFAULT '',
    p_notes TEXT DEFAULT '',
    payment_deadline TEXT DEFAULT '',
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_properties_aid ON properties(a_id);

-- 7. Rents Table (Rental leases linked to properties)
CREATE TABLE IF NOT EXISTS rents (
    r_id TEXT PRIMARY KEY,
    p_id TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    tenant_contact TEXT DEFAULT '',
    rent_amount REAL NOT NULL DEFAULT 0,
    rent_start_date TEXT NOT NULL DEFAULT '',
    rent_end_date TEXT DEFAULT '',
    next_rent_due TEXT NOT NULL DEFAULT '',
    r_notes TEXT DEFAULT '',
    FOREIGN KEY (p_id) REFERENCES properties(p_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rents_pid ON rents(p_id);

-- 8. Asset Sales Table (Liquidated assets / real estate sales)
CREATE TABLE IF NOT EXISTS asset_sales (
    sale_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_contact TEXT DEFAULT '',
    sale_price REAL NOT NULL DEFAULT 0,
    sale_date TEXT NOT NULL DEFAULT '',
    payment_due_date TEXT DEFAULT '',
    sale_notes TEXT DEFAULT '',
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sales_aid ON asset_sales(a_id);

-- 9. Payments Table (All debits and credits: purchase, maturity, sale proceeds)
CREATE TABLE IF NOT EXISTS payments (
    payment_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL,
    payment_type TEXT NOT NULL CHECK(payment_type IN ('PURCHASE', 'RECEIVED', 'DEBIT', 'CREDIT')),
    payment_context TEXT NOT NULL CHECK(payment_context IN ('PURCHASE', 'SALE', 'MATURITY', 'RENT', 'OTHER')),
    amount REAL NOT NULL DEFAULT 0,
    payment_date TEXT NOT NULL DEFAULT '',
    due_date TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PAID', 'PENDING', 'OVERDUE', 'RECEIVED', 'MISSED', 'CANCELLED', 'COMPLETED')),
    notes TEXT DEFAULT '',
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payments_aid ON payments(a_id);
CREATE INDEX IF NOT EXISTS idx_payments_context ON payments(payment_type, payment_context, status);

-- 10. Documents Table (File attachments metadata)
CREATE TABLE IF NOT EXISTS documents (
    d_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL,
    r_id TEXT DEFAULT '',
    d_category TEXT NOT NULL DEFAULT 'OTHER',
    d_name TEXT NOT NULL,
    d_link TEXT NOT NULL,
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_documents_aid ON documents(a_id);
CREATE INDEX IF NOT EXISTS idx_documents_rid ON documents(r_id);

-- 11. Contributions Table (Recurring deposit schedules)
CREATE TABLE IF NOT EXISTS contributions (
    contribution_id TEXT PRIMARY KEY,
    a_id TEXT NOT NULL,
    contribution_type TEXT NOT NULL DEFAULT 'RD_DEPOSIT',
    amount REAL NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'MONTHLY',
    due_date TEXT NOT NULL DEFAULT '',
    payment_date TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PAID', 'PENDING', 'MISSED', 'DEFAULTED', 'CANCELLED', 'COMPLETED')),
    notes TEXT DEFAULT '',
    FOREIGN KEY (a_id) REFERENCES assets(a_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contributions_aid ON contributions(a_id);

-- 12. Internal Migration & Integrity Ledger
CREATE TABLE IF NOT EXISTS _migration_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_table TEXT NOT NULL UNIQUE,
    records_read INTEGER NOT NULL,
    records_imported INTEGER NOT NULL,
    file_sha256 TEXT NOT NULL,
    migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const ALL_TABLE_NAMES = [
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
] as const;

export type TableName = (typeof ALL_TABLE_NAMES)[number];
