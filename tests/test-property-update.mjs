import assert from 'node:assert';
import { CsvDatabaseService, PROPERTIES_COLUMNS, ASSETS_COLUMNS, PAYMENTS_COLUMNS, RENTS_COLUMNS, DOCUMENTS_COLUMNS } from '../src/services/csvDatabase.ts';

console.log('================================================================');
console.log('  FamilyVault — Real Estate Property Update & Finance Tests     ');
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

// -----------------------------------------------------------------------------
// Test 1: Property Update in Place (p_id, a_id preserved, no duplicates)
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing property update in place with p_id and a_id preserved...');
const db = new CsvDatabaseService();

// Mock mock API persistence so we test in-memory logic safely
db.persistTable = async () => {};

db.familyMembers = [{ member_id: 'mem_1', member_name: 'Test Member' }];
db.assets = [
  { a_id: 'ast_101', member_id: 'mem_1', asset_type: 'REAL_ESTATE', asset_name: 'Original Plot', asset_status: 'ACTIVE' }
];
db.properties = [
  {
    p_id: 'prop_201',
    a_id: 'ast_101',
    p_type: 'LAND',
    name: 'Original Plot',
    location: 'Old Road, Bangalore',
    area_sqft: '1200',
    area_unit: 'sq.ft',
    purchase_price: 2500000,
    party_name: 'Original Seller',
    party_contact: '9876543210',
    purchase_date: '2026-01-15',
    p_notes: 'Original note',
    payment_deadline: '2026-06-30'
  }
];

// Verify initial count
assert.strictEqual(db.properties.length, 1, 'Initial properties count should be 1');
assert.strictEqual(db.assets.length, 1, 'Initial assets count should be 1');

// Update all fields
await db.updateProperty('prop_201', {
  name: 'Updated Luxury Villa',
  p_type: 'PRIVATE_HOUSE',
  location: 'Palm Avenue, Whitefield',
  area_sqft: '3500',
  area_unit: 'sq.ft',
  purchase_price: 7500000,
  party_name: 'New Builder Corp',
  party_contact: '9988776655',
  purchase_date: '2026-02-20',
  p_notes: 'Updated note with registry reference',
  payment_deadline: '2026-12-31'
});

// Update asset name as InvestmentContext does
await db.updateAsset('ast_101', { asset_name: 'Updated Luxury Villa' });

// Verify property was updated in place with zero duplicates
assert.strictEqual(db.properties.length, 1, 'Properties count must remain exactly 1 (no duplicates)');
assert.strictEqual(db.assets.length, 1, 'Assets count must remain exactly 1 (no duplicates)');

const updatedProp = db.properties[0];
assert.strictEqual(updatedProp.p_id, 'prop_201', 'p_id must remain unchanged');
assert.strictEqual(updatedProp.a_id, 'ast_101', 'a_id must remain unchanged');
assert.strictEqual(updatedProp.name, 'Updated Luxury Villa', 'Name must be updated');
assert.strictEqual(updatedProp.p_type, 'PRIVATE_HOUSE', 'Type must be updated');
assert.strictEqual(updatedProp.location, 'Palm Avenue, Whitefield', 'Location must be updated');
assert.strictEqual(updatedProp.area_sqft, '3500', 'Area must be updated');
assert.strictEqual(updatedProp.area_unit, 'sq.ft', 'Unit must be updated');
assert.strictEqual(updatedProp.purchase_price, 7500000, 'Price must be updated');
assert.strictEqual(updatedProp.party_name, 'New Builder Corp', 'Party name must be updated');
assert.strictEqual(updatedProp.party_contact, '9988776655', 'Party contact must be updated');
assert.strictEqual(updatedProp.purchase_date, '2026-02-20', 'Purchase date must be updated');
assert.strictEqual(updatedProp.p_notes, 'Updated note with registry reference', 'Notes must be updated');
assert.strictEqual(updatedProp.payment_deadline, '2026-12-31', 'Payment deadline must be updated');

// Verify asset name was updated
assert.strictEqual(db.assets[0].asset_name, 'Updated Luxury Villa', 'Asset name in assets table must match property name');

console.log('  [PASS] Property updated in place, no duplicate asset or property records created.\n');

// -----------------------------------------------------------------------------
// Test 2: Finance Calculations & Deadline Prioritization
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing finance calculation & deadline priority after edit...');

// Add an initial purchase payment of 2,000,000 paid
db.payments = [
  {
    payment_id: 'pay_1',
    a_id: 'ast_101',
    p_id: 'prop_201',
    payment_type: 'PURCHASE',
    payment_context: 'PURCHASE',
    amount: 2000000,
    payment_date: '2026-02-20',
    due_date: '2026-02-20',
    status: 'PAID',
    notes: 'Initial Down Payment'
  },
  {
    payment_id: 'pay_2_bal',
    a_id: 'ast_101',
    p_id: 'prop_201',
    payment_type: 'PURCHASE',
    payment_context: 'PURCHASE',
    amount: 500000, // old balance from original 2.5M price
    payment_date: '',
    due_date: '2026-06-30', // old deadline
    status: 'PENDING',
    notes: 'Balance Purchase Payment Due'
  }
];

// Calculate finances before payment sync
const financesBeforeSync = db.calculatePropertyFinances('prop_201');
assert.strictEqual(financesBeforeSync.totalPurchasePaid, 2000000, 'Paid should be 2,000,000');
assert.strictEqual(financesBeforeSync.paymentLeft, 5500000, 'Remaining balance should be 7.5M - 2M = 5.5M');
// Due date should prioritize the property's updated payment_deadline (2026-12-31) over the stale pending payment due date (2026-06-30)
assert.strictEqual(financesBeforeSync.nextDueDate, '2026-12-31', 'nextDueDate must prioritize property.payment_deadline');

console.log('  [PASS] Financial calculations reflect new purchase price and prioritized payment deadline.\n');

// -----------------------------------------------------------------------------
// Test 3: Synchronizing Pending Balance Payment
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing synchronization of pending balance payment...');

// Synchronize pending payment as InvestmentContext does
const purchasePayments = db.payments.filter(
  (p) => (p.a_id === 'ast_101' || p.p_id === 'prop_201') && p.payment_type === 'PURCHASE' && (p.status === 'PAID' || p.status === 'RECEIVED')
);
const totalPaid = purchasePayments.reduce((s, p) => s + Number(p.amount), 0);
const remainingBalance = Math.max(0, updatedProp.purchase_price - totalPaid);

const pendingPayment = db.payments.find(
  (p) => (p.a_id === 'ast_101' || p.p_id === 'prop_201') && p.payment_type === 'PURCHASE' && (p.status === 'PENDING' || p.status === 'OVERDUE')
);

assert(pendingPayment, 'Pending payment must exist');
await db.updatePayment(pendingPayment.payment_id, {
  amount: remainingBalance,
  due_date: updatedProp.payment_deadline || '',
  p_id: updatedProp.p_id
});

const updatedPending = db.payments.find((p) => p.payment_id === pendingPayment.payment_id);
assert.strictEqual(updatedPending.amount, 5500000, 'Pending balance payment amount must match 5,500,000');
assert.strictEqual(updatedPending.due_date, '2026-12-31', 'Pending balance due_date must match 2026-12-31');

console.log('  [PASS] Pending balance payment synchronized with new price and deadline.\n');

// -----------------------------------------------------------------------------
// Test 4: Preservation of Linked Rents and Documents
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing preservation of linked rents and attached documents...');

db.rents = [
  {
    r_id: 'rent_101',
    p_id: 'prop_201',
    tenant_name: 'John Tenant',
    tenant_contact: '9123456789',
    rent_amount: 45000,
    rent_start_date: '2026-03-01',
    rent_end_date: '',
    next_rent_due: '2026-04-01',
    r_notes: 'Monthly advance on 1st'
  }
];

db.documents = [
  {
    d_id: 'doc_1',
    a_id: 'ast_101',
    r_id: '',
    d_category: 'LAND',
    d_name: 'Original Title Deed',
    d_link: '/uploads/title_deed.pdf',
    p_id: 'prop_201'
  }
];

// Perform another property update
await db.updateProperty('prop_201', {
  name: 'Updated Luxury Villa - Phase 2'
});

// Attach a new document
await db.addDocuments([
  {
    d_id: 'doc_2',
    a_id: 'ast_101',
    r_id: '',
    d_category: 'PRIVATE_HOUSE',
    d_name: 'Khata Certificate',
    d_link: '/uploads/khata.pdf',
    p_id: 'prop_201'
  }
]);

// Verify rent is completely preserved
assert.strictEqual(db.rents.length, 1, 'Rent record must be preserved');
assert.strictEqual(db.rents[0].tenant_name, 'John Tenant');
assert.strictEqual(db.rents[0].rent_amount, 45000);

// Verify original document is preserved AND new document is attached
assert.strictEqual(db.documents.length, 2, 'Both documents must exist');
assert(db.documents.some((d) => d.d_name === 'Original Title Deed'), 'Original document must exist');
assert(db.documents.some((d) => d.d_name === 'Khata Certificate'), 'New document must exist');

console.log('  [PASS] Linked rental records and attached documents fully preserved.\n');

// -----------------------------------------------------------------------------
// Test 5: Fully Paid Property Balance Cleanup
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing fully paid property updates...');

// If price is edited down to 2,000,000 (equal to already paid 2,000,000)
await db.updateProperty('prop_201', { purchase_price: 2000000 });
const newRemaining = Math.max(0, 2000000 - totalPaid);
assert.strictEqual(newRemaining, 0, 'Remaining balance should be 0');

if (newRemaining <= 0 && pendingPayment) {
  await db.deletePayment(pendingPayment.payment_id);
}

const activePending = db.payments.find(
  (p) => (p.a_id === 'ast_101' || p.p_id === 'prop_201') && p.payment_type === 'PURCHASE' && (p.status === 'PENDING' || p.status === 'OVERDUE')
);
assert.strictEqual(activePending, undefined, 'Pending payment should be removed when balance is 0');

const financesFullyPaid = db.calculatePropertyFinances('prop_201');
assert.strictEqual(financesFullyPaid.paymentLeft, 0, 'Payment left should be 0');
assert.strictEqual(financesFullyPaid.paymentStatus, 'completed', 'Payment status should be completed');

console.log('  [PASS] Fully paid property cleanly deletes pending balance payment.\n');

console.log('================================================================');
console.log('  ALL PROPERTY UPDATE & DATA INTEGRITY TESTS PASSED!            ');
console.log('================================================================\n');
