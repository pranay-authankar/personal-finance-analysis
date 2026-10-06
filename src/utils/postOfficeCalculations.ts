import type { PostOfficeSchemeType, ContributionRecord } from '../types';

export interface SchemeMetadata {
  type: PostOfficeSchemeType;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  defaultRate: number; // current standard govt interest rate
  typicalTenureMonths: number;
  description: string;
  payoutFrequency?: 'Monthly' | 'Quarterly' | 'At Maturity' | 'Flexible';
  minDeposit: number;
  maxDeposit?: number; // undefined if no upper limit
  limitDescription: string;
  presetChips: number[];
}

/**
 * V1 supports ONLY these 4 official Post Office schemes:
 * 1. Post Office Time Deposit (TD / Post Office FD)
 * 2. Monthly Income Scheme (MIS)
 * 3. Recurring Deposit (RD)
 * 4. Senior Citizens Savings Scheme (SCSS)
 */
export const V1_SUPPORTED_SCHEMES: PostOfficeSchemeType[] = ['TD', 'MIS', 'RD', 'SCSS'];

export const SCHEME_METADATA: Record<PostOfficeSchemeType, SchemeMetadata> = {
  TD: {
    type: 'TD',
    name: 'Post Office FD / Time Deposit',
    shortName: 'Post Office TD / FD',
    icon: '📮',
    color: '#2563EB',
    defaultRate: 7.50, // 5-yr default
    typicalTenureMonths: 60,
    description: 'Government fixed term deposit for 1, 2, 3, or 5 years with sovereign safety',
    payoutFrequency: 'At Maturity',
    minDeposit: 1000,
    limitDescription: 'Min ₹1,000 • No maximum limit',
    presetChips: [50000, 100000, 250000, 500000]
  },
  POTD: {
    // Alias to TD for backwards compatibility
    type: 'TD',
    name: 'Post Office FD / Time Deposit',
    shortName: 'Post Office TD / FD',
    icon: '📮',
    color: '#2563EB',
    defaultRate: 7.50,
    typicalTenureMonths: 60,
    description: 'Government fixed term deposit for 1, 2, 3, or 5 years with sovereign safety',
    payoutFrequency: 'At Maturity',
    minDeposit: 1000,
    limitDescription: 'Min ₹1,000 • No maximum limit',
    presetChips: [50000, 100000, 250000, 500000]
  },
  MIS: {
    type: 'MIS',
    name: 'Monthly Income Scheme (MIS)',
    shortName: 'Monthly Income Scheme',
    icon: '💵',
    color: '#059669',
    defaultRate: 7.40,
    typicalTenureMonths: 60, // 5 years
    description: 'One-time deposit generating guaranteed monthly pension-like income',
    payoutFrequency: 'Monthly',
    minDeposit: 1000,
    maxDeposit: 1500000,
    limitDescription: 'Min ₹1,000 • Max ₹9,00,000 (Single) / ₹15,00,000 (Joint)',
    presetChips: [100000, 450000, 900000, 1500000]
  },
  RD: {
    type: 'RD',
    name: 'Recurring Deposit (RD)',
    shortName: 'Recurring Deposit',
    icon: '⏳',
    color: '#0284C7',
    defaultRate: 6.70,
    typicalTenureMonths: 60, // 5 years
    description: 'Monthly savings scheme with quarterly compounded interest and deposit schedule',
    payoutFrequency: 'At Maturity',
    minDeposit: 100,
    limitDescription: 'Min ₹100/month • No upper maximum limit',
    presetChips: [1000, 2500, 5000, 10000]
  },
  SCSS: {
    type: 'SCSS',
    name: 'Senior Citizens Savings Scheme (SCSS)',
    shortName: 'Senior Citizen Scheme',
    icon: '👴',
    color: '#D97706',
    defaultRate: 8.20,
    typicalTenureMonths: 60, // 5 years
    description: 'High-yield government security for seniors with quarterly guaranteed payout',
    payoutFrequency: 'Quarterly',
    minDeposit: 1000,
    maxDeposit: 3000000,
    limitDescription: 'Min ₹1,000 • Max ₹30,00,000',
    presetChips: [500000, 1000000, 1500000, 3000000]
  }
};

/**
 * Maps standard Post Office TD rates by tenure
 */
export function getTdRateByTenure(tenureYears: number): number {
  switch (tenureYears) {
    case 1:
      return 6.90;
    case 2:
      return 7.00;
    case 3:
      return 7.10;
    case 5:
    default:
      return 7.50;
  }
}

/**
 * Calculates monthly interest income for MIS:
 * Monthly Interest = (Principal * Rate / 100) / 12
 */
export function calculateMISMonthlyPayout(principal: number, ratePct: number): number {
  if (!principal || !ratePct) return 0;
  return Math.round((principal * (ratePct / 100)) / 12);
}

/**
 * Calculates quarterly interest income for SCSS:
 * Quarterly Interest = (Principal * Rate / 100) / 4
 */
export function calculateSCSSQuarterlyPayout(principal: number, ratePct: number): number {
  if (!principal || !ratePct) return 0;
  return Math.round((principal * (ratePct / 100)) / 4);
}

/**
 * Calculates Recurring Deposit maturity amount:
 * Standard Post Office 5-year RD quarterly compounded
 */
export function calculateRDMaturity(monthlyInstallment: number, ratePct: number, months: number = 60): {
  totalDeposited: number;
  maturityAmount: number;
  interestEarned: number;
} {
  const P = Number(monthlyInstallment) || 0;
  const r = (Number(ratePct) || 0) / 100;
  const n = 4; // Quarterly compounding
  const totalDeposited = P * months;

  if (P <= 0 || r <= 0 || months <= 0) {
    return { totalDeposited, maturityAmount: totalDeposited, interestEarned: 0 };
  }

  // Compound formula over quarterly intervals
  let maturityAmount = 0;
  for (let m = 1; m <= months; m++) {
    const remainingYears = (months - m + 1) / 12;
    maturityAmount += P * Math.pow(1 + r / n, n * remainingYears);
  }

  const roundedMaturity = Math.round(maturityAmount);
  return {
    totalDeposited,
    maturityAmount: roundedMaturity,
    interestEarned: Math.max(0, roundedMaturity - totalDeposited)
  };
}

/**
 * Auto-calculates maturity date given opening date & scheme type
 */
export function getDefaultMaturityDateForScheme(
  schemeType: PostOfficeSchemeType,
  openingDateStr: string,
  tenureYears: number = 5
): string {
  const openDate = openingDateStr ? new Date(openingDateStr) : new Date();
  const matDate = new Date(openDate);

  if (schemeType === 'TD' || schemeType === 'POTD') {
    matDate.setFullYear(matDate.getFullYear() + (tenureYears || 5));
  } else {
    // MIS, RD, SCSS are all standard 5-year schemes
    matDate.setFullYear(matDate.getFullYear() + 5);
  }

  return matDate.toISOString().split('T')[0];
}

/**
 * Calculates next monthly interest payout date (for MIS)
 * Occurs on the same day-of-month as start_date each month.
 */
export function calculateNextMonthlyInterestDate(startDateStr: string): string {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  const day = start.getDate();
  const today = new Date();

  // Candidate: this month on `day`
  let candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate <= today) {
    // Next month on `day`
    candidate = new Date(today.getFullYear(), today.getMonth() + 1, day);
  }

  return candidate.toISOString().split('T')[0];
}

/**
 * Calculates next quarterly interest payout date (for SCSS)
 * Post Office pays SCSS interest on March 31, June 30, September 30, and December 31
 * or on quarterly anniversaries of the deposit start date.
 */
export function calculateNextQuarterlyInterestDate(startDateStr: string): string {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  const today = new Date();

  // Check quarterly intervals: 3, 6, 9, 12... months from start
  let testDate = new Date(start);
  while (testDate <= today) {
    testDate.setMonth(testDate.getMonth() + 3);
  }

  return testDate.toISOString().split('T')[0];
}

/**
 * Derives RD payment schedule metrics strictly from contributions.csv
 */
export function calculateRdDerivedMetrics(contributions: ContributionRecord[]): {
  totalDepositedAmount: number;
  depositsMadeCount: number;
  missedDepositsCount: number;
  nextDepositDate: string;
  upcomingDepositAmount: number;
} {
  const todayStr = new Date().toISOString().split('T')[0];

  const paidContribs = contributions.filter((c) => c.status === 'PAID');
  const totalDepositedAmount = paidContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const depositsMadeCount = paidContribs.length;

  const missedContribs = contributions.filter(
    (c) => c.status === 'MISSED' || (c.status === 'PENDING' && c.due_date < todayStr)
  );
  const missedDepositsCount = missedContribs.length;

  // Upcoming pending deposits (sorted by due_date ascending)
  const pendingContribs = contributions
    .filter((c) => c.status === 'PENDING' && c.due_date >= todayStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const nextPending = pendingContribs[0];
  const nextDepositDate = nextPending ? nextPending.due_date : (missedContribs[0]?.due_date || '');
  const upcomingDepositAmount = nextPending ? Number(nextPending.amount) || 0 : (contributions[0]?.amount || 0);

  return {
    totalDepositedAmount,
    depositsMadeCount,
    missedDepositsCount,
    nextDepositDate,
    upcomingDepositAmount
  };
}

/**
 * Generates initial 60-month RD contribution schedule for contributions.csv
 */
export function generateRdSchedule(
  a_id: string,
  monthlyAmount: number,
  startDateStr: string,
  initialPaidMonths: number = 1,
  totalMonths: number = 60
): ContributionRecord[] {
  const records: ContributionRecord[] = [];
  const start = new Date(startDateStr);
  const depositDay = start.getDate();
  const now = new Date();

  for (let m = 0; m < totalMonths; m++) {
    const dueDate = new Date(start.getFullYear(), start.getMonth() + m, depositDay);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Determine status
    let status = 'PENDING';
    let paymentDate = '';
    if (m < initialPaidMonths) {
      status = 'PAID';
      paymentDate = dueDateStr <= now.toISOString().split('T')[0] ? dueDateStr : now.toISOString().split('T')[0];
    } else if (dueDate < now && status !== 'PAID') {
      status = 'MISSED';
    }

    records.push({
      contribution_id: `rd_cnt_${a_id}_${m + 1}_${Date.now()}`,
      a_id,
      contribution_type: 'RD_DEPOSIT',
      amount: monthlyAmount,
      frequency: 'MONTHLY',
      due_date: dueDateStr,
      payment_date: paymentDate,
      status,
      notes: `Installment #${m + 1} of ${totalMonths}`
    });
  }

  return records;
}
