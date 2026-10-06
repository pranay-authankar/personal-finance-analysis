import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5173/api/csv';

const EXPECTED_SCHEMAS = {
  family_members: [
    'member_id',
    'member_name'
  ],
  assets: [
    'a_id',
    'member_id',
    'asset_type',
    'asset_name',
    'asset_status'
  ],
  fds: [
    'fd_id',
    'a_id',
    'bank_name',
    'acc_number',
    'principal',
    'interest_rate',
    'start_date',
    'maturity_date',
    'actual_end_date'
  ],
  post_office: [
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
  ],
  bullions: [
    'b_id',
    'a_id',
    'b_type',
    'purchase_value',
    'purchase_date',
    'b_status'
  ],
  properties: [
    'p_id',
    'a_id',
    'p_type',
    'name',
    'location',
    'purchase_price',
    'party_name',
    'party_contact',
    'purchase_date',
    'p_notes'
  ],
  rents: [
    'r_id',
    'p_id',
    'tenant_name',
    'tenant_contact',
    'rent_amount',
    'rent_start_date',
    'rent_end_date',
    'next_rent_due',
    'r_notes'
  ],
  asset_sales: [
    'sale_id',
    'a_id',
    'buyer_name',
    'buyer_contact',
    'sale_price',
    'sale_date',
    'payment_due_date',
    'sale_notes'
  ],
  payments: [
    'payment_id',
    'a_id',
    'payment_type',
    'amount',
    'payment_date',
    'due_date',
    'status',
    'notes'
  ],
  documents: [
    'd_id',
    'a_id',
    'r_id',
    'd_category',
    'd_name',
    'd_link'
  ]
};

async function run() {
  console.log('--- Testing Final V1 CSV ONLY Architecture (10 Tables) ---');

  for (const [table, expectedColumns] of Object.entries(EXPECTED_SCHEMAS)) {
    const res = await fetch(`${API_BASE}/${table}`);
    if (!res.ok) {
      throw new Error(`Failed to GET ${table}: HTTP ${res.status}`);
    }
    const text = await res.text();
    const firstLine = text.trim().split('\n')[0].replace(/\r/g, '');
    const columns = firstLine.split(',');

    console.log(`Table '${table}':`);
    console.log(`  Expected columns (${expectedColumns.length}):`, expectedColumns.join(', '));
    console.log(`  Actual columns   (${columns.length}):`, columns.join(', '));

    const matches = expectedColumns.length === columns.length && expectedColumns.every((col, i) => col === columns[i]);
    if (!matches) {
      throw new Error(`Header mismatch in table ${table}!`);
    }

    const rowCount = text.trim().split('\n').length - 1;
    console.log(`  -> Match OK! Clean state confirmed: ${rowCount} rows.`);
    if (rowCount !== 0) {
      throw new Error(`Table ${table} should have 0 data rows, but found ${rowCount}!`);
    }
  }

  console.log('\n--- Testing Persistence (POST update & restore) ---');
  const originalFdsRes = await fetch(`${API_BASE}/fds`);
  const originalFdsCsv = await originalFdsRes.text();

  // Append a temporary test FD row
  const testFdRow = `fd_test_999,ast_fd_test_999,State Bank of India,•••• 8899,100000,7.1,2026-01-01,2027-01-01,`;
  const updatedFdsCsv = originalFdsCsv.trim() + '\n' + testFdRow + '\n';

  const postRes = await fetch(`${API_BASE}/fds`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    body: updatedFdsCsv
  });

  const postResult = await postRes.json();
  console.log('POST /api/csv/fds response:', postResult);

  // Check file on disk
  const diskContent = fs.readFileSync(path.resolve('data/fds.csv'), 'utf8');
  if (!diskContent.includes('fd_test_999')) {
    throw new Error('Test FD not found on disk data/fds.csv!');
  }
  console.log('  -> Confirmed written to data/fds.csv on disk!');

  // Restore original clean empty state
  await fetch(`${API_BASE}/fds`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    body: originalFdsCsv
  });
  console.log('  -> Restored clean zero-row fds.csv successfully!');

  console.log('\nALL 10 CSV TABLES VERIFIED SUCCESSFULLY WITH 0 RECORDS AND EXACT SCHEMAS!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
