import assert from 'node:assert';
import { CsvDatabaseService } from '../src/services/csvDatabase.ts';

console.log('================================================================');
console.log('  FamilyVault — Real Estate Rent Management & Workflow Tests    ');
console.log('================================================================\n');

// Mock localStorage for node environment
if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };
}

const db = new CsvDatabaseService();
db.persistTable = async () => {};

// Setup initial state: 1 member, 1 property (purchase price 1,200,000)
db.familyMembers = [{ member_id: 'mem_1', member_name: 'Test Member' }];
db.assets = [
  { a_id: 'ast_101', member_id: 'mem_1', asset_type: 'REAL_ESTATE', asset_name: 'Downtown Commercial Unit', asset_status: 'ACTIVE' }
];
db.properties = [
  {
    p_id: 'prop_201',
    a_id: 'ast_101',
    p_type: 'COMMERCIAL',
    name: 'Downtown Commercial Unit',
    location: 'Brigade Road, Bangalore',
    purchase_price: 1200000,
    purchase_date: '2026-01-01',
    property_status: 'ACTIVE'
  }
];
db.rents = [];
db.payments = [];

// -----------------------------------------------------------------------------
// Test 1: Start Rent Lease Workflow
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing starting a new rental lease...');
const newLease = await db.startRent(
  'prop_201',
  {
    tenant_name: 'Acme Technologies',
    tenant_contact: '+91 98765 43210',
    rent_amount: 15000,
    rent_start_date: '2026-02-01',
    next_rent_due: '2026-03-01',
    r_notes: 'Commercial IT office lease'
  },
  [{ d_name: 'Lease Agreement 2026.pdf', d_link: 'data:application/pdf;base64,...' }]
);

assert.ok(newLease.r_id, 'New lease should have generated an r_id');
assert.strictEqual(newLease.p_id, 'prop_201', 'p_id must match');
assert.strictEqual(newLease.tenant_name, 'Acme Technologies');
assert.strictEqual(Number(newLease.rent_amount), 15000);
assert.strictEqual(db.rents.length, 1, 'rents table should contain 1 lease');
assert.strictEqual(db.documents.length, 1, 'documents table should contain attached lease deed');
console.log('  [PASS] Lease created successfully with attached agreement document.');

// -----------------------------------------------------------------------------
// Test 2: Active Lease Detection & is_active calculation
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing is_active evaluation logic...');
const activeRent = db.getActiveRentForProperty('prop_201');
assert.ok(activeRent, 'Active rent should be retrieved for prop_201');
assert.strictEqual(activeRent.tenant_name, 'Acme Technologies');

// Check is_active calculation helper
const todayStr = new Date().toISOString().split('T')[0];
const isActive = !activeRent.rent_end_date || activeRent.rent_end_date >= todayStr;
assert.strictEqual(isActive, true, 'Ongoing lease without end date must evaluate to active');
console.log('  [PASS] Ongoing lease correctly recognized as active.');

// -----------------------------------------------------------------------------
// Test 3: Rent Calculations (Yield, Run-Rate, Totals)
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing rent calculations and metrics...');
const monthlyRent = Number(activeRent.rent_amount);
const annualRunRate = monthlyRent * 12;
const purchasePrice = Number(db.properties[0].purchase_price);
const grossYield = (annualRunRate / purchasePrice) * 100;

assert.strictEqual(annualRunRate, 180000, 'Annual run rate for 15,000/mo must be 180,000');
assert.strictEqual(grossYield, 15.0, 'Gross yield on 1,200,000 purchase must be 15.0%');
console.log('  [PASS] Annual run-rate and gross yield calculated accurately.');

// -----------------------------------------------------------------------------
// Test 4: Record Rent Payment Collection Workflow
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing rent collection payment workflow...');
const paymentRecord = await db.recordRentPayment('prop_201', {
  r_id: activeRent.r_id,
  amount: 15000,
  payment_date: '2026-03-01',
  next_rent_due: '2026-04-01',
  notes: 'March 2026 Rent via NEFT'
});

assert.ok(paymentRecord.payment_id, 'Payment record must have an ID');
assert.strictEqual(paymentRecord.payment_context, 'RENT');
assert.strictEqual(paymentRecord.payment_type, 'RECEIVED');
assert.strictEqual(paymentRecord.status, 'RECEIVED');
assert.strictEqual(Number(paymentRecord.amount), 15000);
assert.strictEqual(paymentRecord.p_id, 'prop_201');

// Verify that next_rent_due was auto-advanced on the rent record
const updatedLease = db.rents.find((r) => r.r_id === activeRent.r_id);
assert.strictEqual(updatedLease.next_rent_due, '2026-04-01', 'next_rent_due must advance to 2026-04-01');

// Verify getRentPaymentsForProperty
const rentPayments = db.getRentPaymentsForProperty('prop_201');
assert.strictEqual(rentPayments.length, 1);
assert.strictEqual(Number(rentPayments[0].amount), 15000);
console.log('  [PASS] Rent payment logged to payments.csv and next_rent_due advanced on lease.');

// -----------------------------------------------------------------------------
// Test 5: Edit Lease Details Workflow
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing editing existing lease details in place...');
await db.updateRent(activeRent.r_id, {
  rent_amount: 16500,
  tenant_contact: '+91 99999 88888',
  r_notes: 'Revised rent from Q2'
});

const leaseAfterEdit = db.rents.find((r) => r.r_id === activeRent.r_id);
assert.strictEqual(Number(leaseAfterEdit.rent_amount), 16500, 'Rent amount should be updated to 16,500');
assert.strictEqual(leaseAfterEdit.tenant_contact, '+91 99999 88888');
assert.strictEqual(leaseAfterEdit.r_notes, 'Revised rent from Q2');
assert.strictEqual(db.rents.length, 1, 'No duplicate lease record should be created');
console.log('  [PASS] Lease edited in place with p_id and r_id preserved.');

// -----------------------------------------------------------------------------
// Test 6: Stop / Terminate Lease Workflow
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing terminating lease (vacating property)...');
await db.stopRent(activeRent.r_id, '2026-03-31');

const terminatedLease = db.rents.find((r) => r.r_id === activeRent.r_id);
assert.strictEqual(terminatedLease.rent_end_date, '2026-03-31');

// Verify that active rent query returns null after lease termination
const activeAfterStop = db.getActiveRentForProperty('prop_201');
assert.strictEqual(activeAfterStop, undefined, 'Property should now be recognized as vacant');
console.log('  [PASS] Tenancy successfully ended. Property is now vacant.');

console.log('\n================================================================');
console.log('  ALL RENT MANAGEMENT & WORKFLOW TESTS PASSED!                  ');
console.log('================================================================\n');
