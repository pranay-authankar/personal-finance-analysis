// ============================================================================
// Fixed Database Structure for V1 (CSV Tables: family_members, assets, fds, post_office, bullions, properties, rents, asset_sales, payments, documents)
// ============================================================================

import { parseLocalDate, getLocalDateString } from '../utils/dateUtils';

export type PropertyType =
  | 'LAND'
  | 'COMMERCIAL_PROPERTY'
  | 'PRIVATE_PROPERTIES'
  | 'PRIVATE_HOUSE'
  | 'Land'
  | 'Commercial Property'
  | 'Private Properties'
  | 'Private House';

export type PropertyStatus = 'ACTIVE' | 'SOLD' | 'DELETED';
export type PaymentType = 'PURCHASE' | 'RECEIVED';
export type PaymentContext = 'PURCHASE' | 'SALE' | 'MATURITY' | 'RENT' | 'OTHER';
export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'RECEIVED';

// 1. Family Members -> family_members.csv
export interface FamilyMemberRecord {
  member_id: string; // unique member ID / primary key
  member_name: string;
}

// 2. Assets -> assets.csv
export type AssetType = 'FD' | 'POST_OFFICE' | 'BULLION' | 'REAL_ESTATE';
export type AssetStatus = 'ACTIVE' | 'SOLD' | 'MATURED' | 'REDEEMED' | 'CLOSED' | 'DELETED';

export interface AssetRecord {
  a_id: string; // unique asset identifier across all asset tables
  member_id: string; // foreign key connecting to family_members.csv
  asset_type: AssetType; // FD / POST_OFFICE / BULLION / REAL_ESTATE
  asset_name: string;
  asset_status: AssetStatus;
}

// 3. FDs -> fds.csv
export interface FdRecord {
  fd_id: string; // unique FD ID / primary key
  a_id: string; // unique asset identifier
  bank_name: string;
  acc_number: string;
  principal: number;
  interest_rate: number;
  start_date: string; // YYYY-MM-DD
  maturity_date: string; // YYYY-MM-DD
  actual_end_date: string; // YYYY-MM-DD
  // Backwards compatibility helpers
  interest?: number;
  end_date?: string;
}

// 4. Post Office -> post_office.csv
export interface PostOfficeRecord {
  po_id: string; // unique PO ID / primary key
  a_id: string; // unique asset identifier
  scheme_name: string;
  account_number: string;
  principal: number | string | null; // blank for RD
  interest_rate: number;
  start_date: string; // YYYY-MM-DD
  maturity_date: string; // YYYY-MM-DD
  actual_end_date: string; // YYYY-MM-DD
  scheme_status: string; // ACTIVE / MATURED / REDEEMED / CLOSED
}

// 5. Bullions -> bullions.csv
export type BullionCsvType = 'GOLD' | 'SILVER' | 'DIAMOND' | 'STONE' | 'PLATINUM' | 'OTHER' | string;
export type BullionCsvStatus = 'HELD' | 'SOLD';

export interface BullionRecord {
  b_id: string; // unique Bullion ID / primary key
  a_id: string; // unique asset identifier
  b_type: BullionCsvType;
  purchase_value: number;
  purchase_date: string; // YYYY-MM-DD
  b_status: BullionCsvStatus;
  payment_due_date?: string; // YYYY-MM-DD for full balance payment due date
  weight?: number;
  weight_unit?: string; // mg, g, kg, pounds, tola, oz
  purchase_rate?: number; // Rate/Price in Rupees
  weight_display?: string;
}

// 6. Properties -> properties.csv
export interface PropertyRecord {
  p_id: string; // unique property ID / primary key
  a_id: string; // unique asset identifier
  p_type: PropertyType; // LAND / COMMERCIAL_PROPERTY / PRIVATE_PROPERTIES
  name: string;
  location: string;
  area_sqft?: number | string; // Area numeric value or legacy string
  area_unit?: string; // Unit (sq.ft, acre, sq.yard, sq.m, guntha, bigha, hectare, cent)
  purchase_price: number;
  party_name: string; // seller/party from whom the property was purchased
  party_contact: string;
  purchase_date: string; // YYYY-MM-DD
  p_notes: string;
  property_status?: PropertyStatus; // derived from assets.csv asset_status
  payment_deadline?: string; // YYYY-MM-DD for purchase payment deadline
}

// 7. Rents -> rents.csv
export interface RentRecord {
  r_id: string; // unique rent ID / primary key
  p_id: string; // property ID / foreign key
  tenant_name: string;
  tenant_contact: string;
  rent_amount: number;
  rent_start_date: string; // YYYY-MM-DD
  rent_end_date: string; // YYYY-MM-DD
  next_rent_due: string; // YYYY-MM-DD
  r_notes: string;
  is_active?: boolean; // derived helper in UI
}

// 8. Asset Sales -> asset_sales.csv
export interface AssetSaleRecord {
  sale_id: string; // unique sale ID / primary key
  a_id: string; // asset ID / foreign key
  buyer_name: string;
  buyer_contact: string;
  sale_price: number;
  sale_date: string; // YYYY-MM-DD
  payment_due_date: string; // YYYY-MM-DD
  sale_notes: string;
}

// 9. Overall Payments -> payments.csv
export interface PaymentRecord {
  payment_id: string; // unique payment ID / primary key
  a_id: string; // asset ID / foreign key
  payment_type: PaymentType | string; // PURCHASE / RECEIVED
  payment_context: PaymentContext | string; // PURCHASE / SALE / MATURITY / RENT / OTHER
  amount: number;
  payment_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  status: PaymentStatus | string; // PAID / PENDING / OVERDUE / RECEIVED
  notes: string;
  // Backward compatibility
  p_id?: string;
}

// Alias for backwards compatibility
export type PropertyPaymentRecord = PaymentRecord;

// 10. Documents -> documents.csv
export type DocumentCategory =
  | 'LAND'
  | 'COMMERCIAL'
  | 'PRIVATE_HOUSE'
  | 'RENT'
  | 'FD'
  | 'POST_OFFICE'
  | 'BULLION'
  | 'OTHER';

export interface DocumentRecord {
  d_id: string; // unique document ID / primary key
  a_id: string; // asset ID / foreign key
  r_id: string; // rent ID / foreign key (if rent document)
  d_category: DocumentCategory | string; // LAND / COMMERCIAL / PRIVATE_HOUSE / RENT / FD / etc.
  d_name: string;
  d_link: string; // URL / data link
  // Backward compatibility optional props
  p_id?: string;
  fd_id?: string;
}

// 11. Contributions -> contributions.csv
export type ContributionType = 'RD_DEPOSIT' | 'OTHER';
export type ContributionFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
export type ContributionStatus = 'PAID' | 'PENDING' | 'MISSED' | 'DEFAULTED';

export interface ContributionRecord {
  contribution_id: string; // unique contribution ID / primary key
  a_id: string; // asset ID / foreign key
  contribution_type: ContributionType | string; // RD_DEPOSIT
  amount: number;
  frequency: ContributionFrequency | string; // MONTHLY
  due_date: string; // YYYY-MM-DD
  payment_date: string; // YYYY-MM-DD
  status: ContributionStatus | string; // PAID / PENDING / MISSED / DEFAULTED
  notes: string;
}

// Backward-compat type for RealisedFundRecord
export type RealisedReason = 'SOLD' | 'MATURED' | 'REDEEMED' | 'OTHER' | 'Sold' | 'Matured' | 'Redeemed' | 'Other';

export interface RealisedFundRecord {
  f_id: string;
  a_id: string;
  amount: number;
  f_reason: RealisedReason | string;
  fund_date: string;
}

// ============================================================================
// UI Application Model Types
// ============================================================================

export interface FixedDeposit {
  id: string;
  a_id?: string;
  bankName: string;
  accountNumber: string;
  principal: number;
  interestRate: number; // e.g. 7.1 for 7.10%
  startDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  actualEndDate?: string; // YYYY-MM-DD
  photoUrl?: string; // base64 or image url
  photoDocName?: string;
  status?: 'active' | 'matured' | 'redeemed';
  realizedFundId?: string;
}

export function fdRecordToFixedDeposit(
  f: FdRecord,
  docLink?: string,
  referenceDate: Date = new Date()
): FixedDeposit {
  const isRedeemed = Boolean(f.actual_end_date && f.actual_end_date.trim() !== '');
  const maturity = f.maturity_date || f.end_date || '';
  const parsedMat = parseLocalDate(maturity);
  const refMidnight = new Date(referenceDate);
  refMidnight.setHours(0, 0, 0, 0);

  const isMatured = !isRedeemed && Boolean(parsedMat) && parsedMat!.getTime() <= refMidnight.getTime();
  const status: 'active' | 'matured' | 'redeemed' = isRedeemed
    ? 'redeemed'
    : isMatured
    ? 'matured'
    : 'active';

  return {
    id: f.fd_id,
    a_id: f.a_id,
    bankName: f.bank_name,
    accountNumber: f.acc_number,
    principal: Number(f.principal) || 0,
    interestRate: Number(f.interest_rate !== undefined ? f.interest_rate : f.interest) || 0,
    startDate: f.start_date,
    maturityDate: maturity,
    actualEndDate: f.actual_end_date || undefined,
    photoUrl: docLink || '',
    status
  };
}

export function fixedDepositToFdRecord(fd: FixedDeposit): FdRecord {
  return {
    fd_id: fd.id,
    a_id: fd.a_id || `ast_fd_${fd.id}`,
    bank_name: fd.bankName,
    acc_number: fd.accountNumber,
    principal: Number(fd.principal) || 0,
    interest_rate: Number(fd.interestRate) || 0,
    start_date: fd.startDate,
    maturity_date: fd.maturityDate,
    actual_end_date:
      fd.actualEndDate ||
      (fd.status === 'redeemed' ? getLocalDateString() : '')
  };
}

export type PostOfficeSchemeType = 'TD' | 'MIS' | 'RD' | 'SCSS' | 'POTD';

export interface PostOfficeInvestment {
  id: string; // po_id
  a_id?: string;
  schemeType: PostOfficeSchemeType;
  schemeName: string;
  accountNumber: string;
  amount: number; // Principal for TD, MIS, SCSS; or Total Deposited for RD
  interestRate: number;
  openingDate: string; // start_date
  maturityDate: string; // maturity_date
  actualEndDate?: string;
  status: 'active' | 'matured' | 'redeemed' | 'closed';
  branch?: string;
  nominee?: string;
  notes?: string;
  photoUrl?: string;
  photoDocName?: string;
  // Scheme specific fields:
  tenureYears?: number; // for TD (1, 2, 3, 5 years)
  monthlyDeposit?: number; // for RD
  // Derived RD metrics (from contributions.csv)
  nextDepositDate?: string;
  depositsMadeCount?: number;
  missedDepositsCount?: number;
  totalDepositedAmount?: number;
  upcomingDepositAmount?: number;
  // Derived MIS/SCSS interest metrics
  expectedMonthlyInterest?: number;
  expectedQuarterlyInterest?: number;
  nextInterestDate?: string;
  // Legacy fields for backward compatibility
  monthlyPayout?: number;
  quarterlyPayout?: number;
  maturityAmount?: number;
  monthlyInstallment?: number;
}

export type BullionType = 'GOLD' | 'SILVER' | 'PLATINUM' | 'DIAMOND' | 'OTHER' | string;

export interface BullionInvestment {
  id: string;
  a_id?: string;
  type: BullionType;
  typeName: string;
  itemName: string;
  purchaseDate?: string;
  purchaseRate?: number;
  weight?: number;
  weightUnit?: string;
  weightGrams?: number;
  weightDisplay?: string;
  investedValue?: number;
  photoUrl?: string;
  notes?: string;
  status?: 'active' | 'sold';
  realizedFundId?: string;
  // Payment deadline & tracking fields
  initialPayment?: number;
  paymentDueDate?: string;
  remainingPayment?: number;
  paymentStatus?: 'completed' | 'pending' | 'missed';
}

export type RealizedReason = 'Matured' | 'Sold' | 'Redeemed' | 'Other';
export type RealizedSourceCategory = 'FD' | 'Post Office' | 'Bullions' | 'Real Estate' | 'Stocks' | 'Other';

export interface RealizedFund {
  id: string;
  amount: number;
  sourceCategory: RealizedSourceCategory;
  sourceName: string;
  dateReceived: string;
  reason: RealizedReason;
  remarks?: string;
  sourceInvestmentId?: string;
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
  properties?: PropertyRecord[];
  rents?: RentRecord[];
  propertyDocuments?: DocumentRecord[];
  propertyPayments?: PropertyPaymentRecord[];
}

export type DeadlineLevel = 0 | 1 | 2 | 3 | 4;

export interface DeadlineClassification {
  level: DeadlineLevel;
  label: string;
  daysLeft: number;
  relativeText: string;
  isOverdue: boolean;
  hexColor: string;
  bgTint: string;
  borderTint: string;
  textDark: string;
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
  hexColor: string;
  isUrgent?: boolean;
  bgTint?: string;
  borderTint?: string;
}

export interface PortfolioSummary {
  total: number;
  activeInvestmentsTotal: number;
  realizedFundsTotal: number;
  totalNetWorth: number;
  fdTotal: number;
  postOfficeTotal: number;
  bullionsTotal: number;
  realEstateTotal: number;
  stocksTotal: number;
  realizedTotal: number;
  upcomingMaturitiesCount: number;
  nextMaturityDays: number | null;
  breakdown: {
    fds: number;
    postOffice: number;
    stocksMf: number;
    realEstate: number;
    bullions: number;
    realizedFunds: number;
  };
}

export type ViewMode = 'cards' | 'table';
export type FilterType = 'all' | 'urgent' | 'this-year' | 'over-year' | 'with-photo';
export type SortType = 'maturity-asc' | 'maturity-desc' | 'amount-desc' | 'amount-asc' | 'rate-desc' | 'bank-asc' | 'tenure-asc';
