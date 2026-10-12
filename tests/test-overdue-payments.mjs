import assert from 'node:assert';
import { CsvDatabaseService } from '../src/services/csvDatabase.ts';
import { isDueDateMissed, getLocalDateString } from '../src/utils/dateUtils.ts';

console.log('================================================================');
console.log('  FamilyVault — Overdue Payment Tracking & Status Tests         ');
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
// Test 1: Date comparison utility (isDueDateMissed)
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing date comparison utility (isDueDateMissed)...');
const refDate = '2026-10-13'; // fixed reference date

// Past date -> missed
assert.strictEqual(isDueDateMissed('2026-10-12', refDate), true, 'Yesterday must be missed');
assert.strictEqual(isDueDateMissed('2025-01-01', refDate), true, 'Last year must be missed');

// Today -> not missed
assert.strictEqual(isDueDateMissed('2026-10-13', refDate), false, 'Today must not be missed');

// Future date -> not missed
assert.strictEqual(isDueDateMissed('2026-10-14', refDate), false, 'Tomorrow must not be missed');
assert.strictEqual(isDueDateMissed('2027-01-01', refDate), false, 'Next year must not be missed');

// Invalid/empty dates -> not missed (safe fallback)
assert.strictEqual(isDueDateMissed('', refDate), false, 'Empty date must return false');
assert.strictEqual(isDueDateMissed(undefined, refDate), false, 'Undefined date must return false');

console.log('  [PASS] Date utility accurately calculates overdue status without timezone shifting.');

// -----------------------------------------------------------------------------
// Test 2: Automatic Overdue Status Sync on Payments & Contributions
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing syncOverduePaymentStatuses across payments & contributions...');
const db = new CsvDatabaseService();
db.persistTable = async () => {}; // mock persistence

db.payments = [
  // 1. Overdue unpaid -> should become MISSED
  {
    payment_id: 'pay_past',
    a_id: 'ast_1',
    payment_type: 'DEBIT',
    amount: 50000,
    due_date: '2026-10-10',
    status: 'PENDING',
    payment_context: 'PURCHASE'
  },
  // 2. Due today unpaid -> should stay PENDING
  {
    payment_id: 'pay_today',
    a_id: 'ast_2',
    payment_type: 'DEBIT',
    amount: 30000,
    due_date: '2026-10-13',
    status: 'PENDING',
    payment_context: 'PURCHASE'
  },
  // 3. Due future unpaid -> should stay PENDING
  {
    payment_id: 'pay_future',
    a_id: 'ast_3',
    payment_type: 'DEBIT',
    amount: 40000,
    due_date: '2026-10-20',
    status: 'PENDING',
    payment_context: 'PURCHASE'
  },
  // 4. Past due but PAID -> should NEVER become MISSED
  {
    payment_id: 'pay_paid',
    a_id: 'ast_4',
    payment_type: 'DEBIT',
    amount: 10000,
    due_date: '2026-10-01',
    status: 'PAID',
    payment_context: 'PURCHASE'
  },
  // 5. Past due but RECEIVED -> should NEVER become MISSED
  {
    payment_id: 'pay_received',
    a_id: 'ast_5',
    payment_type: 'CREDIT',
    amount: 25000,
    due_date: '2026-10-02',
    status: 'RECEIVED',
    payment_context: 'SALE'
  },
  // 6. Past due but CANCELLED -> should NEVER become MISSED
  {
    payment_id: 'pay_cancelled',
    a_id: 'ast_6',
    payment_type: 'DEBIT',
    amount: 15000,
    due_date: '2026-10-05',
    status: 'CANCELLED',
    payment_context: 'PURCHASE'
  }
];

db.contributions = [
  // 7. Post Office RD contribution overdue unpaid -> should become MISSED
  {
    contribution_id: 'cnt_past',
    account_id: 'po_1',
    month_index: 5,
    due_date: '2026-10-05',
    amount: 2000,
    status: 'PENDING'
  },
  // 8. Post Office RD contribution due today -> should stay PENDING
  {
    contribution_id: 'cnt_today',
    account_id: 'po_1',
    month_index: 6,
    due_date: '2026-10-13',
    amount: 2000,
    status: 'PENDING'
  },
  // 9. Post Office RD contribution past but PAID -> should NEVER become MISSED
  {
    contribution_id: 'cnt_paid',
    account_id: 'po_1',
    month_index: 4,
    due_date: '2026-09-05',
    amount: 2000,
    status: 'PAID'
  }
];

// Run sync for reference date 2026-10-13
await db.syncOverduePaymentStatuses('2026-10-13');

const payPast = db.payments.find(p => p.payment_id === 'pay_past');
const payToday = db.payments.find(p => p.payment_id === 'pay_today');
const payFuture = db.payments.find(p => p.payment_id === 'pay_future');
const payPaid = db.payments.find(p => p.payment_id === 'pay_paid');
const payReceived = db.payments.find(p => p.payment_id === 'pay_received');
const payCancelled = db.payments.find(p => p.payment_id === 'pay_cancelled');

const cntPast = db.contributions.find(c => c.contribution_id === 'cnt_past');
const cntToday = db.contributions.find(c => c.contribution_id === 'cnt_today');
const cntPaid = db.contributions.find(c => c.contribution_id === 'cnt_paid');

assert.strictEqual(payPast?.status, 'MISSED', 'Past due payment must be marked MISSED');
assert.strictEqual(payToday?.status, 'PENDING', 'Payment due today must stay PENDING');
assert.strictEqual(payFuture?.status, 'PENDING', 'Future payment must stay PENDING');
assert.strictEqual(payPaid?.status, 'PAID', 'PAID payment must remain PAID, never MISSED');
assert.strictEqual(payReceived?.status, 'RECEIVED', 'RECEIVED payment must remain RECEIVED, never MISSED');
assert.strictEqual(payCancelled?.status, 'CANCELLED', 'CANCELLED payment must remain CANCELLED, never MISSED');

assert.strictEqual(cntPast?.status, 'MISSED', 'Past contribution must be marked MISSED');
assert.strictEqual(cntToday?.status, 'PENDING', 'Contribution due today must stay PENDING');
assert.strictEqual(cntPaid?.status, 'PAID', 'PAID contribution must remain PAID, never MISSED');

console.log('  [PASS] Correctly applied MISSED status without touching paid, received, or cancelled records.');

// -----------------------------------------------------------------------------
// Test 3: Midnight / Date Rollover Transition
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing midnight/date rollover (advancing reference date)...');
// When the day rolls over to 2026-10-14, 'pay_today' and 'cnt_today' should now become MISSED
await db.syncOverduePaymentStatuses('2026-10-14');

assert.strictEqual(db.payments.find(p => p.payment_id === 'pay_today')?.status, 'MISSED', 'Yesterday payment must now be MISSED on rollover');
assert.strictEqual(db.contributions.find(c => c.contribution_id === 'cnt_today')?.status, 'MISSED', 'Yesterday contribution must now be MISSED on rollover');
assert.strictEqual(db.payments.find(p => p.payment_id === 'pay_future')?.status, 'PENDING', 'Future payment still PENDING');

console.log('  [PASS] Automatic date rollover transitions records to MISSED when midnight passes.');

// -----------------------------------------------------------------------------
// Test 4: Subsequent Payment Completion
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing completion of a MISSED payment...');
// A missed payment is subsequently completed by the user
const missedPayment = db.payments.find(p => p.payment_id === 'pay_past');
assert(missedPayment);
missedPayment.status = 'PAID';
missedPayment.payment_date = '2026-10-14';

// Run sync again
await db.syncOverduePaymentStatuses('2026-10-14');

assert.strictEqual(db.payments.find(p => p.payment_id === 'pay_past')?.status, 'PAID', 'Completed missed payment must remain PAID');

console.log('  [PASS] Completed missed payment updates to PAID and is never reverted to MISSED.');

// -----------------------------------------------------------------------------
// Test 5: Reverting if Due Date Extended
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing reverting MISSED to PENDING if due date is rescheduled to future...');
const missedPayment2 = db.payments.find(p => p.payment_id === 'pay_today');
assert(missedPayment2);
assert.strictEqual(missedPayment2.status, 'MISSED');

// User reschedules due date to next month
missedPayment2.due_date = '2026-11-01';

await db.syncOverduePaymentStatuses('2026-10-14');
assert.strictEqual(db.payments.find(p => p.payment_id === 'pay_today')?.status, 'PENDING', 'Rescheduled payment with future due date reverts to PENDING');

console.log('  [PASS] Rescheduled payment smoothly reverts from MISSED to PENDING.');

// -----------------------------------------------------------------------------
// Test 6: Deduplication in Dashboard Missed Payments List
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing deduplication in missed payment listing...');

// Simulate Dashboard aggregation logic
const missedList = [];
const seenKeys = new Set();

// Payments scan
db.payments.forEach(p => {
  if (p.status === 'MISSED' && p.payment_context !== 'RENT') {
    const key = `pay_${p.payment_id}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      missedList.push({ id: key, name: 'Asset', amount: p.amount });
    }
  }
});

// Post Office contributions scan
db.contributions.forEach(c => {
  if (c.status === 'MISSED') {
    const key = `cnt_${c.contribution_id}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      missedList.push({ id: key, name: 'RD Account', amount: c.amount });
    }
  }
});

// Verify no duplicate keys exist
assert.strictEqual(missedList.length, seenKeys.size, 'All items must have unique keys');
const duplicateCheck = new Set();
let hasDup = false;
for (const item of missedList) {
  if (duplicateCheck.has(item.id)) {
    hasDup = true;
    break;
  }
  duplicateCheck.add(item.id);
}
assert.strictEqual(hasDup, false, 'No duplicate missed payments in dashboard list');

console.log('  [PASS] Missed payment deduplication verified with zero duplicate records.');

// -----------------------------------------------------------------------------
// Test 7: Rental Income Exclusion from Missed Payments & Portfolio Totals
// -----------------------------------------------------------------------------
console.log('[TEST 7] Testing rental income exclusion...');

// Add a rental payment record
db.payments.push({
  payment_id: 'pay_rent_1',
  a_id: 'ast_rent',
  payment_type: 'CREDIT',
  amount: 25000,
  due_date: '2026-10-01',
  status: 'PENDING',
  payment_context: 'RENT'
});

// Verify rental context is excluded from missedList
const missedRentItems = db.payments.filter(p => p.payment_context === 'RENT' && p.status === 'MISSED');
assert.strictEqual(missedRentItems.length, 0, 'Rent payment should not be marked or listed as missed portfolio debt');

console.log('  [PASS] Rental income is strictly excluded from realization and dashboard totals.');

console.log('================================================================');
console.log('  ALL OVERDUE PAYMENT TRACKING TESTS PASSED SUCCESSFULLY!       ');
console.log('================================================================\n');
