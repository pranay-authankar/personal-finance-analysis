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

// Setup initial state: 1 member, 2 properties (purchase price 1,200,000 and 2,500,000)
db.familyMembers = [{ member_id: 'mem_1', member_name: 'Test Member' }];
db.assets = [
  { a_id: 'ast_101', member_id: 'mem_1', asset_type: 'REAL_ESTATE', asset_name: 'Downtown Commercial Unit', asset_status: 'ACTIVE' },
  { a_id: 'ast_102', member_id: 'mem_1', asset_type: 'REAL_ESTATE', asset_name: 'Suburban Villa', asset_status: 'ACTIVE' }
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
  },
  {
    p_id: 'prop_202',
    a_id: 'ast_102',
    p_type: 'PRIVATE_HOUSE',
    name: 'Suburban Villa',
    location: 'Whitefield, Bangalore',
    purchase_price: 2500000,
    purchase_date: '2026-02-01',
    property_status: 'ACTIVE'
  }
];
db.rents = [];
db.payments = [];
db.documents = [];

// -----------------------------------------------------------------------------
// Test 1: Start Rent Lease Workflow (Adapted to Simplified 5 Fields + Dates)
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing starting a new rental lease with 5 fields...');
const initialPaymentCount = db.payments.length;
const newLease = await db.startRent(
  'prop_201',
  {
    tenant_name: 'Acme Technologies',
    tenant_contact: '+91 98765 43210',
    rent_amount: 15000,
    rent_start_date: '2026-02-01',
    rent_end_date: ''
  },
  [{ d_name: 'Lease Agreement 2026.pdf', d_link: 'data:application/pdf;base64,...' }]
);

assert.ok(newLease.r_id, 'New lease should have generated an r_id');
assert.strictEqual(newLease.p_id, 'prop_201', 'p_id must match');
assert.strictEqual(newLease.tenant_name, 'Acme Technologies');
assert.strictEqual(newLease.tenant_contact, '+91 98765 43210');
assert.strictEqual(Number(newLease.rent_amount), 15000);
assert.strictEqual(newLease.rent_start_date, '2026-02-01');
assert.strictEqual(db.rents.length, 1, 'rents table should contain 1 lease');
assert.strictEqual(db.documents.length, 1, 'documents table should contain attached lease deed');
assert.strictEqual(db.payments.length, initialPaymentCount, 'No payment records should be created when rent is entered');
console.log('  [PASS] Lease created successfully with 5 core fields and attached document.');

// -----------------------------------------------------------------------------
// Test 2: Active Lease Detection & Document Retrieval
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing is_active evaluation and rent documents retrieval...');
const activeRent = db.getActiveRentForProperty('prop_201');
assert.ok(activeRent, 'Active rent should be retrieved for prop_201');
assert.strictEqual(activeRent.tenant_name, 'Acme Technologies');

const todayStr = new Date().toISOString().split('T')[0];
const isActive = !activeRent.rent_end_date || activeRent.rent_end_date >= todayStr;
assert.strictEqual(isActive, true, 'Ongoing lease without end date must evaluate to active');

const rentDocs = db.getDocumentsForRent('prop_201', activeRent.r_id);
assert.strictEqual(rentDocs.length, 1, 'Attached rent document must be found for rent record');
assert.strictEqual(rentDocs[0].d_name, 'Lease Agreement 2026.pdf');
console.log('  [PASS] Active lease and linked documents verified.');

// -----------------------------------------------------------------------------
// Test 3: Edit Lease Details In-Place & Reassign Property Association
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing editing tenant details, monthly rent, and property association...');
await db.updateRent(activeRent.r_id, {
  p_id: 'prop_202',
  tenant_name: 'Acme Global Labs',
  tenant_contact: '+91 99999 88888',
  rent_amount: 18000
});

assert.strictEqual(db.rents.length, 1, 'No duplicate lease record should be created when editing');
const updatedLease = db.rents.find((r) => r.r_id === activeRent.r_id);
assert.strictEqual(updatedLease.p_id, 'prop_202', 'Property association should be updated to prop_202');
assert.strictEqual(updatedLease.tenant_name, 'Acme Global Labs');
assert.strictEqual(updatedLease.tenant_contact, '+91 99999 88888');
assert.strictEqual(Number(updatedLease.rent_amount), 18000);

// Verify that linked document was also updated to prop_202
const reassociatedDoc = db.documents.find((d) => d.r_id === activeRent.r_id);
assert.strictEqual(reassociatedDoc.p_id, 'prop_202', 'Document must follow property re-association');
assert.strictEqual(reassociatedDoc.a_id, 'ast_102', 'Document must follow asset re-association');
console.log('  [PASS] Lease edited in-place with property association updated and documents preserved.');

// -----------------------------------------------------------------------------
// Test 4: Financial Logic — No Payment Records Created or Modified on Rent Edit
// -----------------------------------------------------------------------------
console.log('[TEST 4] Verifying financial isolation (no payments on rent edit)...');
assert.strictEqual(db.payments.length, 0, 'Zero payments must exist; rent entry must never create payment records');
console.log('  [PASS] Verified: Zero payment records created for rent entry or modification.');

// -----------------------------------------------------------------------------
// Test 5: Delete Rent History of Property Being Sold
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing deletion of rent history when property is sold...');
// Add an additional lease for prop_201 to test property-specific deletion
await db.startRent('prop_201', {
  tenant_name: 'Tenant 201',
  tenant_contact: '1234567890',
  rent_amount: 10000,
  rent_start_date: '2026-03-01'
}, [{ d_name: 'Prop201 Agreement.pdf', d_link: 'url' }]);

assert.strictEqual(db.rents.length, 2, 'Should now have 2 rents across prop_201 and prop_202');

// Now sell prop_202: delete the rent history of prop_202
await db.deleteRentsForProperty('prop_202');

const prop202Rents = db.rents.filter((r) => r.p_id === 'prop_202');
assert.strictEqual(prop202Rents.length, 0, 'Rent history of sold property prop_202 must be completely deleted');

const remainingRents = db.rents.filter((r) => r.p_id === 'prop_201');
assert.strictEqual(remainingRents.length, 1, 'Rent history of unrelated property prop_201 must remain intact');

// Verify that documents for the sold property rent were also cleaned up
const prop202RentDocs = db.documents.filter((d) => d.p_id === 'prop_202' && (d.d_category === 'RENT' || d.d_category === 'RENTAL'));
assert.strictEqual(prop202RentDocs.length, 0, 'Rent documents of sold property must be deleted with rent history');
console.log('  [PASS] Rent history of sold property cleanly deleted while preserving unrelated records.');

// -----------------------------------------------------------------------------
// Test 6: Stop / Terminate Lease Workflow
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing terminating lease with optional rent_end_date...');
const active201 = db.getActiveRentForProperty('prop_201');
assert.ok(active201);
await db.stopRent(active201.r_id, '2026-03-31');

const terminatedLease = db.rents.find((r) => r.r_id === active201.r_id);
assert.strictEqual(terminatedLease.rent_end_date, '2026-03-31');

const activeAfterStop = db.getActiveRentForProperty('prop_201');
assert.strictEqual(activeAfterStop, undefined, 'Property should now be recognized as vacant');
console.log('  [PASS] Tenancy successfully ended. Property is now vacant.');

console.log('\n================================================================');
console.log('  ALL SIMPLIFIED RENT MANAGEMENT TESTS PASSED!                  ');
console.log('================================================================\n');
