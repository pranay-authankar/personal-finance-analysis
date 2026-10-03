export interface FixedDeposit {
  id: string;
  bankName: string;
  accountNumber: string;
  principal: number;
  interestRate: number; // e.g. 7.1 for 7.10%
  startDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  photoUrl?: string; // base64 or image url
}

export type PostOfficeSchemeType =
  | 'RD' // Recurring Deposit
  | 'MIS' // Monthly Income Scheme
  | 'POTD' // Post Office Time Deposit (FD)
  | 'SCSS' // Senior Citizen Savings Scheme
  | 'PPF' // Public Provident Fund
  | 'NSC' // National Savings Certificate
  | 'KVP' // Kisan Vikas Patra
  | 'SUKANYA' // Sukanya Samriddhi Account
  | 'MAHILA_SAMMAN'; // Mahila Samman Savings Certificate

export interface PostOfficeInvestment {
  id: string;
  schemeType: PostOfficeSchemeType;
  schemeName: string; // Display title, e.g. "Monthly Income Scheme (MIS)"
  accountNumber: string;
  amount: number; // Principal / Deposit amount / Current balance
  openingDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  interestRate?: number; // % p.a.
  branch?: string; // Post Office branch
  nominee?: string; // Nominee name & relation
  photoUrl?: string; // Document / Passbook photo

  // Scheme-Specific Fields
  monthlyInstallment?: number; // for RD
  monthlyPayout?: number; // for MIS
  quarterlyPayout?: number; // for SCSS
  tenureYears?: number; // for Time Deposit (1, 2, 3, 5)
  financialYearContribution?: number; // for PPF
  currentBalance?: number; // for PPF / Sukanya
  girlChildName?: string; // for Sukanya
  girlChildDob?: string; // for Sukanya
  guardianName?: string; // for Sukanya
  maturityAmount?: number; // calculated / estimated payout
}

export interface OtherAssets {
  postOffice: number; // kept for legacy / external
  stocksMf: number;
  realEstate: number;
  bullions: number;
  cashInHand: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  otherAssets: OtherAssets;
  fds: FixedDeposit[];
  postOfficeInvestments?: PostOfficeInvestment[];
}

export interface FDCalculation {
  principal: number;
  maturityAmount: number;
  interestEarned: number;
  tenureDays: number;
  tenureFormatted: string;
}

export type MaturityLevel = 1 | 2 | 3 | 4 | 5;

export interface MaturityClassification {
  level: MaturityLevel;
  shadeClass: string;
  pillClass: string;
  label: string;
  daysLeft: number;
  relativeText: string;
  isUrgent: boolean;
  hexColor: string;
  bgTint: string;
  borderTint: string;
}

export interface PortfolioBreakdown {
  fds: number;
  postOffice: number;
  stocksMf: number;
  realEstate: number;
  bullions: number;
  cashInHand: number;
}

export interface PortfolioSummary {
  total: number;
  fdTotal: number;
  postOfficeTotal: number;
  breakdown: PortfolioBreakdown;
}

export type FilterType = 'all' | 'urgent' | 'this-year' | 'over-year' | 'with-photo';
export type SortType = 'maturity-asc' | 'maturity-desc' | 'amount-desc' | 'amount-asc' | 'rate-desc' | 'bank-asc' | 'tenure-asc';
export type ViewMode = 'cards' | 'table';
