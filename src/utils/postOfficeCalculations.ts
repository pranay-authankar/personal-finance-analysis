import type { PostOfficeSchemeType } from '../types';

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
}

export const SCHEME_METADATA: Record<PostOfficeSchemeType, SchemeMetadata> = {
  RD: {
    type: 'RD',
    name: 'National Savings Recurring Deposit (RD)',
    shortName: 'Recurring Deposit',
    icon: '⏳',
    color: '#0284C7',
    defaultRate: 6.70,
    typicalTenureMonths: 60, // 5 years
    description: 'Monthly savings scheme with quarterly compounded interest',
    payoutFrequency: 'At Maturity'
  },
  MIS: {
    type: 'MIS',
    name: 'Post Office Monthly Income Scheme (MIS)',
    shortName: 'Monthly Income Scheme',
    icon: '💵',
    color: '#059669',
    defaultRate: 7.40,
    typicalTenureMonths: 60, // 5 years
    description: 'Fixed deposit generating guaranteed monthly pension-like income',
    payoutFrequency: 'Monthly'
  },
  POTD: {
    type: 'POTD',
    name: 'Post Office Time Deposit (FD)',
    shortName: 'Time Deposit (POTD)',
    icon: '📮',
    color: '#2563EB',
    defaultRate: 7.50, // 5-yr rate
    typicalTenureMonths: 60,
    description: 'Government fixed term deposit for 1, 2, 3, or 5 years',
    payoutFrequency: 'At Maturity'
  },
  SCSS: {
    type: 'SCSS',
    name: 'Senior Citizen Savings Scheme (SCSS)',
    shortName: 'Senior Citizen Scheme',
    icon: '👴',
    color: '#D97706',
    defaultRate: 8.20,
    typicalTenureMonths: 60, // 5 years
    description: 'High-yield government security for individuals aged 60+',
    payoutFrequency: 'Quarterly'
  },
  PPF: {
    type: 'PPF',
    name: 'Public Provident Fund (PPF)',
    shortName: 'Public Provident Fund',
    icon: '🛡️',
    color: '#7C3AED',
    defaultRate: 7.10,
    typicalTenureMonths: 180, // 15 years
    description: '15-year sovereign savings with complete EEE tax-free status',
    payoutFrequency: 'Flexible'
  },
  NSC: {
    type: 'NSC',
    name: 'National Savings Certificate (NSC)',
    shortName: 'National Savings Cert.',
    icon: '📜',
    color: '#4F46E5',
    defaultRate: 7.70,
    typicalTenureMonths: 60, // 5 years
    description: '5-year certificate with guaranteed compounding interest',
    payoutFrequency: 'At Maturity'
  },
  KVP: {
    type: 'KVP',
    name: 'Kisan Vikas Patra (KVP)',
    shortName: 'Kisan Vikas Patra',
    icon: '🌾',
    color: '#0D9488',
    defaultRate: 7.50,
    typicalTenureMonths: 115, // 9 yrs 7 mos
    description: 'Guaranteed government scheme that doubles your money',
    payoutFrequency: 'At Maturity'
  },
  SUKANYA: {
    type: 'SUKANYA',
    name: 'Sukanya Samriddhi Account (SSA)',
    shortName: 'Sukanya Samriddhi',
    icon: '👧',
    color: '#DB2777',
    defaultRate: 8.20,
    typicalTenureMonths: 252, // 21 years
    description: 'Dedicated high-interest welfare scheme for girl children',
    payoutFrequency: 'Flexible'
  },
  MAHILA_SAMMAN: {
    type: 'MAHILA_SAMMAN',
    name: 'Mahila Samman Savings Certificate',
    shortName: 'Mahila Samman',
    icon: '👩',
    color: '#EA580C',
    defaultRate: 7.50,
    typicalTenureMonths: 24, // 2 years
    description: 'Exclusive 2-year savings certificate for women & girls',
    payoutFrequency: 'At Maturity'
  }
};

/**
 * Calculates monthly interest income for MIS:
 * Monthly Payout = (Principal * Rate / 100) / 12
 */
export function calculateMISMonthlyPayout(principal: number, ratePct: number): number {
  if (!principal || !ratePct) return 0;
  return Math.round((principal * (ratePct / 100)) / 12);
}

/**
 * Calculates quarterly interest income for SCSS:
 * Quarterly Payout = (Principal * Rate / 100) / 4
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

  // Monthly deposit compound formula over quarters
  // M = P * sum((1 + r/4)^(4 * t_k))
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
 * Calculates Mahila Samman 2-year maturity:
 * Quarterly compounding for 2 years
 */
export function calculateMahilaSammanMaturity(principal: number, ratePct: number = 7.50): {
  maturityAmount: number;
  interestEarned: number;
} {
  const P = Number(principal) || 0;
  const r = (Number(ratePct) || 7.50) / 100;
  const n = 4;
  const t = 2; // 2 years
  const maturityAmount = Math.round(P * Math.pow(1 + r / n, n * t));
  return {
    maturityAmount,
    interestEarned: Math.max(0, maturityAmount - P)
  };
}

/**
 * Calculates KVP Doubling Maturity:
 * Exact double at maturity (115 months)
 */
export function calculateKVPMaturity(principal: number): {
  maturityAmount: number;
  interestEarned: number;
} {
  const P = Number(principal) || 0;
  return {
    maturityAmount: P * 2,
    interestEarned: P
  };
}

/**
 * Auto-calculates maturity date given opening date & scheme type
 */
export function getDefaultMaturityDateForScheme(schemeType: PostOfficeSchemeType, openingDateStr: string): string {
  const openDate = openingDateStr ? new Date(openingDateStr) : new Date();
  const matDate = new Date(openDate);

  switch (schemeType) {
    case 'MAHILA_SAMMAN':
      matDate.setFullYear(matDate.getFullYear() + 2);
      break;
    case 'KVP':
      matDate.setMonth(matDate.getMonth() + 115); // 9 yrs 7 mos
      break;
    case 'PPF':
      matDate.setFullYear(matDate.getFullYear() + 15);
      break;
    case 'SUKANYA':
      matDate.setFullYear(matDate.getFullYear() + 21);
      break;
    case 'POTD':
    case 'RD':
    case 'MIS':
    case 'SCSS':
    case 'NSC':
    default:
      matDate.setFullYear(matDate.getFullYear() + 5);
      break;
  }

  return matDate.toISOString().split('T')[0];
}
