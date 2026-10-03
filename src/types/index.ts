export interface FixedDeposit {
  id: string;
  bankName: string;
  accountNumber: string;
  principal: number;
  interestRate: number; // e.g. 7.1 for 7.10%
  startDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  photoUrl?: string; // base64 or image url
  status?: 'active' | 'matured' | 'redeemed';
  realizedFundId?: string;
}

export type PostOfficeSchemeType =
  | 'RD'
  | 'MIS'
  | 'POTD'
  | 'SCSS'
  | 'PPF'
  | 'NSC'
  | 'KVP'
  | 'SUKANYA'
  | 'MAHILA_SAMMAN';

export interface PostOfficeInvestment {
  id: string;
  schemeType: PostOfficeSchemeType;
  schemeName: string;
  accountNumber: string;
  amount: number;
  openingDate: string;
  maturityDate: string;
  interestRate?: number;
  branch?: string;
  nominee?: string;
  photoUrl?: string;
  status?: 'active' | 'matured' | 'redeemed';
  realizedFundId?: string;

  // Scheme-Specific Fields
  monthlyInstallment?: number;
  monthlyPayout?: number;
  quarterlyPayout?: number;
  tenureYears?: number;
  financialYearContribution?: number;
  currentBalance?: number;
  girlChildName?: string;
  girlChildDob?: string;
  guardianName?: string;
  maturityAmount?: number;
}

export type BullionType = 'GOLD' | 'SILVER' | 'PLATINUM' | 'OTHER';

export interface BullionInvestment {
  id: string;
  type: BullionType;
  typeName: string; // e.g. "Gold (24K)", "Silver Bar", "Platinum"
  itemName: string; // User's label, e.g. "Tanishq 24K 50g Gold Bar"
  purchaseDate?: string; // YYYY-MM-DD (Optional)
  purchaseRate?: number; // Rate per gram / unit (Optional)
  weightGrams?: number; // Weight in grams (Optional)
  weightDisplay?: string; // e.g. "50 grams", "2 kg", "1 tola" (Optional)
  investedValue?: number; // Total purchase / recorded value in ₹ (Optional)
  photoUrl?: string; // Photo of invoice / hallmark / certificate (Optional)
  notes?: string; // Additional remarks or purity details (Optional)
  status?: 'active' | 'sold';
  realizedFundId?: string;
}

export type RealizedReason = 'Matured' | 'Sold' | 'Redeemed' | 'Other';
export type RealizedSourceCategory = 'FD' | 'Post Office' | 'Bullions' | 'Real Estate' | 'Stocks' | 'Other';

export interface RealizedFund {
  id: string;
  amount: number;
  sourceCategory: RealizedSourceCategory;
  sourceName: string; // e.g. "FD — SBI", "Gold — 24K 20g Bar", "Property — Plot in Nagpur"
  dateReceived: string; // YYYY-MM-DD
  reason: RealizedReason;
  remarks?: string;
  sourceInvestmentId?: string; // Links back to original asset if converted from active asset
}

export interface OtherAssets {
  postOffice: number;
  stocksMf: number;
  realEstate: number;
  bullions: number;
  cashInHand?: number;
  realizedFunds?: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  otherAssets: OtherAssets;
  fds: FixedDeposit[];
  postOfficeInvestments?: PostOfficeInvestment[];
  bullionsInvestments?: BullionInvestment[];
  realizedFunds?: RealizedFund[];
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
  realizedFunds: number;
}

export interface PortfolioSummary {
  total: number;
  activeInvestmentsTotal: number;
  fdTotal: number;
  postOfficeTotal: number;
  bullionsTotal: number;
  realizedFundsTotal: number;
  breakdown: PortfolioBreakdown;
}

export type FilterType = 'all' | 'urgent' | 'this-year' | 'over-year' | 'with-photo';
export type SortType = 'maturity-asc' | 'maturity-desc' | 'amount-desc' | 'amount-asc' | 'rate-desc' | 'bank-asc' | 'tenure-asc';
export type ViewMode = 'cards' | 'table';

