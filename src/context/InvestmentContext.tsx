import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type {
  FamilyMember,
  FixedDeposit,
  PostOfficeInvestment,
  PostOfficeSchemeType,
  BullionInvestment,
  RealizedFund,
  RealizedReason,
  RealizedSourceCategory,
  PropertyRecord,
  RentRecord,
  DocumentRecord,
  PaymentRecord,
  FdRecord,
  PropertyType,
  PropertyStatus,
  PaymentStatus,
  PortfolioSummary,
  DocumentCategory,
  AssetStatus,
  ContributionRecord,
  PaymentContext
} from '../types';
import {
  fdRecordToFixedDeposit
} from '../types';
import { getEffectiveBullionValue, convertToGrams } from '../utils/bullionCalculations';
import {
  calculateRdDerivedMetrics,
  calculateMISMonthlyPayout,
  calculateSCSSQuarterlyPayout,
  calculateNextMonthlyInterestDate,
  calculateNextQuarterlyInterestDate,
  generateRdSchedule
} from '../utils/postOfficeCalculations';
import { csvDb } from '../services/csvDatabase';
import { useDateTime } from './DateTimeContext';

const STORAGE_KEYS = {
  ACTIVE_MEMBER_ID: 'familyvault_active_member_id',
  IS_AUTHENTICATED: 'familyvault_authenticated'
};

interface InvestmentContextType {
  members: FamilyMember[];
  activeMember: FamilyMember;
  activeMemberId: string;
  isAuthenticated: boolean;
  isCsvLoaded: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  resetDemoData: () => void;
  clearAllData: () => Promise<void>;
  setActiveMemberId: (id: string) => void;
  addMember: (name: string, role: string, avatar: string) => FamilyMember;

  // Fixed Deposits (Backed by fds.csv, assets.csv & documents.csv)
  fds: FdRecord[];
  addOrUpdateFd: (fd: Partial<FixedDeposit>) => FixedDeposit;
  deleteFd: (id: string) => void;
  getFdById: (id: string) => FixedDeposit | undefined;

  // Post Office Investments (Backed by post_office.csv, assets.csv, documents.csv & contributions.csv)
  addOrUpdatePostOffice: (po: Partial<PostOfficeInvestment> & { initialPaidMonths?: number }) => PostOfficeInvestment;
  deletePostOffice: (id: string) => void;
  getPostOfficeById: (id: string) => PostOfficeInvestment | undefined;
  getContributionsForPostOffice: (po_id: string) => ContributionRecord[];
  recordRdContributionPayment: (contribution_id: string, payment_date?: string) => Promise<void>;
  updateRdContribution: (contribution_id: string, updates: Partial<ContributionRecord>) => Promise<void>;

  // Bullions Investments (Backed by bullions.csv, assets.csv & documents.csv)
  addOrUpdateBullion: (b: Partial<BullionInvestment>) => BullionInvestment;
  deleteBullion: (id: string) => void;
  getBullionById: (id: string) => BullionInvestment | undefined;

  // Properties, Rents, Payments, Documents
  properties: PropertyRecord[];
  rents: RentRecord[];
  propertyDocuments: DocumentRecord[];
  propertyPayments: PaymentRecord[];
  realisedFunds: RealizedFund[];

  addProperty: (
    data: {
      p_type: PropertyType;
      name: string;
      location: string;
      area_sqft?: number | string;
      area_unit?: string;
      purchase_price: number;
      party_name: string;
      party_contact: string;
      purchase_date: string;
      p_notes?: string;
      initial_payment?: number;
      payment_deadline?: string;
    },
    documents?: { d_name: string; d_link: string }[]
  ) => PropertyRecord;

  updateProperty: (p_id: string, data: Partial<PropertyRecord>) => void;
  deleteProperty: (p_id: string) => void;
  getPropertyById: (p_id: string) => PropertyRecord | undefined;

  startRent: (
    p_id: string,
    rentData: {
      tenant_name: string;
      tenant_contact: string;
      rent_amount: number;
      rent_start_date: string;
      rent_end_date?: string;
      next_rent_due: string;
      r_notes?: string;
    },
    documents?: { d_name: string; d_link: string }[]
  ) => RentRecord;

  stopRent: (r_id: string) => void;
  getActiveRentForProperty: (p_id: string) => RentRecord | undefined;
  getRentsForProperty: (p_id: string) => RentRecord[];

  sellProperty: (
    p_id: string,
    saleData: {
      buyer_name: string;
      sale_price: number;
      sale_date: string;
      due_date?: string;
      amount_received: number;
      payment_status?: PaymentStatus;
      notes?: string;
      documents?: { d_name: string; d_link: string }[];
    }
  ) => void;

  recordPurchasePayment: (
    p_id: string,
    paymentData: {
      amount: number;
      payment_date: string;
      due_date?: string;
      status?: PaymentStatus;
      notes?: string;
    }
  ) => PaymentRecord;

  recordSalePayment: (
    p_id: string,
    paymentData: {
      amount: number;
      payment_date: string;
      due_date?: string;
      status?: PaymentStatus;
      notes?: string;
    }
  ) => PaymentRecord;

  getPaymentsForProperty: (p_id: string) => PaymentRecord[];

  addDocument: (
    p_id: string,
    docData: {
      d_name: string;
      d_link: string;
      r_id?: string | null;
      d_category?: DocumentCategory;
    }
  ) => DocumentRecord;

  removeDocument: (d_id: string) => void;
  getDocumentsForProperty: (p_id: string) => DocumentRecord[];

  calculatePropertyFinances: (p_id: string) => {
    totalPurchasePaid: number;
    paymentLeft: number;
    totalSaleReceived: number;
    saleReceivableLeft: number;
    nextDueDate?: string;
    dueDateType?: 'purchase_payment_due' | 'sale_receivable_due';
    paymentStatus: 'completed' | 'pending' | 'missed';
  };

  // Realized Funds (Derived from payments.csv where payment_type = RECEIVED)
  addOrUpdateRealizedFund: (rf: Partial<RealizedFund>) => RealizedFund;
  deleteRealizedFund: (id: string) => void;
  getRealizedFundById: (id: string) => RealizedFund | undefined;
  realizeInvestment: (payload: {
    sourceCategory: RealizedSourceCategory;
    sourceId: string;
    amount: number;
    dateReceived: string;
    reason: RealizedReason;
    remarks?: string;
  }) => RealizedFund;

  // Portfolio Calculations
  getPortfolioSummary: (member?: FamilyMember) => PortfolioSummary;
}

const InvestmentContext = createContext<InvestmentContextType | undefined>(undefined);

export const InvestmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { now, todayStr, midnightTicker } = useDateTime();

  const [activeMemberId, setActiveMemberIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_MEMBER_ID) || '';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === 'true';
  });

  // State revision counter to force reactivity on CSV file writes
  const [dataRevision, setDataRevision] = useState<number>(0);
  const [isCsvLoaded, setIsCsvLoaded] = useState<boolean>(false);

  const bumpRevision = () => setDataRevision((r) => r + 1);

  // Startup: Load CSV tables from disk (only source of truth)
  useEffect(() => {
    let isMounted = true;
    csvDb.loadAll().then(() => {
      if (!isMounted) return;
      if (csvDb.familyMembers.length > 0 && !activeMemberId) {
        setActiveMemberIdState(csvDb.familyMembers[0].member_id);
      }
      setIsCsvLoaded(true);
      bumpRevision();
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeMemberId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER_ID, activeMemberId);
    }
  }, [activeMemberId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  // ==========================================================================
  // Derive Application State from CSV Files
  // ==========================================================================

  // Map family_members.csv to FamilyMember[]
  const members: FamilyMember[] = useMemo(() => {
    // Reference dataRevision and midnightTicker to trigger recalculation when CSVs change or midnight rolls over
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dataRevision;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    midnightTicker;

    return csvDb.familyMembers.map((m) => {
      const memberAssets = csvDb.assets.filter(
        (a) => a.member_id === m.member_id && a.asset_status !== 'DELETED'
      );
      const assetIds = new Set(memberAssets.map((a) => a.a_id));

      // 1. FDs
      const memberFds: FixedDeposit[] = [];
      for (const a of memberAssets) {
        if (a.asset_type === 'FD') {
          const f = csvDb.fds.find((item) => item.a_id === a.a_id);
          if (f) {
            const doc = csvDb.documents.find((d) => d.a_id === a.a_id || d.fd_id === f.fd_id);
            memberFds.push(fdRecordToFixedDeposit(f, doc?.d_link, now));
          }
        }
      }

      // 2. Post Office
      const memberPo: PostOfficeInvestment[] = [];
      for (const a of memberAssets) {
        if (a.asset_type === 'POST_OFFICE') {
          const po = csvDb.postOffice.find((item) => item.a_id === a.a_id);
          if (po) {
            const doc = csvDb.documents.find((d) => d.a_id === a.a_id);
            const statusStr = (po.scheme_status || 'active').toLowerCase() as 'active' | 'matured' | 'redeemed' | 'closed';

            let detectedScheme: PostOfficeSchemeType = 'TD';
            const sNameLower = po.scheme_name.toLowerCase();
            if (sNameLower.includes('recurring') || sNameLower.includes('(rd)') || sNameLower === 'rd') {
              detectedScheme = 'RD';
            } else if (sNameLower.includes('monthly income') || sNameLower.includes('(mis)') || sNameLower === 'mis') {
              detectedScheme = 'MIS';
            } else if (sNameLower.includes('senior citizen') || sNameLower.includes('(scss)') || sNameLower === 'scss') {
              detectedScheme = 'SCSS';
            } else {
              detectedScheme = 'TD';
            }

            if (detectedScheme === 'RD') {
              // Derived strictly from contributions.csv
              let contribs = csvDb.contributions.filter((c) => c.a_id === po.a_id);
              if (contribs.length === 0) {
                const monthlyAmt = Number(po.principal) || 5000;
                contribs = generateRdSchedule(po.a_id, monthlyAmt, po.start_date, 1, 60, now);
                csvDb.addContributions(contribs);
              }
              const rdMetrics = calculateRdDerivedMetrics(contribs, now);
              const firstContrib = contribs[0];
              const monthlyDeposit = firstContrib ? Number(firstContrib.amount) || 0 : (Number(po.principal) || 5000);

              let effectiveNextDepositDate = rdMetrics.nextDepositDate;
              if (!effectiveNextDepositDate && po.start_date) {
                effectiveNextDepositDate = calculateNextMonthlyInterestDate(po.start_date, now);
              }

              memberPo.push({
                id: po.po_id,
                a_id: po.a_id,
                schemeType: 'RD',
                schemeName: po.scheme_name || 'Recurring Deposit (RD)',
                accountNumber: po.account_number,
                amount: rdMetrics.totalDepositedAmount || (Number(po.principal) || 0),
                interestRate: Number(po.interest_rate) || 0,
                openingDate: po.start_date,
                maturityDate: po.maturity_date,
                actualEndDate: po.actual_end_date || undefined,
                status: statusStr,
                photoUrl: doc?.d_link || '',
                monthlyDeposit,
                totalDepositedAmount: rdMetrics.totalDepositedAmount,
                depositsMadeCount: rdMetrics.depositsMadeCount,
                missedDepositsCount: rdMetrics.missedDepositsCount,
                nextDepositDate: effectiveNextDepositDate,
                upcomingDepositAmount: rdMetrics.upcomingDepositAmount || monthlyDeposit
              });
            } else if (detectedScheme === 'MIS') {
              const expectedMonthlyInterest = calculateMISMonthlyPayout(
                Number(po.principal) || 0,
                Number(po.interest_rate) || 0
              );
              const nextInterestDate = calculateNextMonthlyInterestDate(po.start_date, now);

              memberPo.push({
                id: po.po_id,
                a_id: po.a_id,
                schemeType: 'MIS',
                schemeName: po.scheme_name || 'Monthly Income Scheme (MIS)',
                accountNumber: po.account_number,
                amount: Number(po.principal) || 0,
                interestRate: Number(po.interest_rate) || 0,
                openingDate: po.start_date,
                maturityDate: po.maturity_date,
                actualEndDate: po.actual_end_date || undefined,
                status: statusStr,
                photoUrl: doc?.d_link || '',
                expectedMonthlyInterest,
                monthlyPayout: expectedMonthlyInterest,
                nextInterestDate
              });
            } else if (detectedScheme === 'SCSS') {
              const expectedQuarterlyInterest = calculateSCSSQuarterlyPayout(
                Number(po.principal) || 0,
                Number(po.interest_rate) || 0
              );
              const nextInterestDate = calculateNextQuarterlyInterestDate(po.start_date, now);

              memberPo.push({
                id: po.po_id,
                a_id: po.a_id,
                schemeType: 'SCSS',
                schemeName: po.scheme_name || 'Senior Citizens Savings Scheme (SCSS)',
                accountNumber: po.account_number,
                amount: Number(po.principal) || 0,
                interestRate: Number(po.interest_rate) || 0,
                openingDate: po.start_date,
                maturityDate: po.maturity_date,
                actualEndDate: po.actual_end_date || undefined,
                status: statusStr,
                photoUrl: doc?.d_link || '',
                expectedQuarterlyInterest,
                quarterlyPayout: expectedQuarterlyInterest,
                nextInterestDate
              });
            } else {
              // TD / FD
              let tenureYears = 5;
              if (po.start_date && po.maturity_date) {
                const startY = new Date(po.start_date).getFullYear();
                const matY = new Date(po.maturity_date).getFullYear();
                if (matY > startY) tenureYears = matY - startY;
              }

              memberPo.push({
                id: po.po_id,
                a_id: po.a_id,
                schemeType: 'TD',
                schemeName: po.scheme_name || 'Post Office FD / Time Deposit',
                accountNumber: po.account_number,
                amount: Number(po.principal) || 0,
                interestRate: Number(po.interest_rate) || 0,
                openingDate: po.start_date,
                maturityDate: po.maturity_date,
                actualEndDate: po.actual_end_date || undefined,
                status: statusStr,
                photoUrl: doc?.d_link || '',
                tenureYears
              });
            }
          }
        }
      }

      // 3. Bullions
      const memberBul: BullionInvestment[] = [];
      for (const a of memberAssets) {
        if (a.asset_type === 'BULLION') {
          const b = csvDb.bullions.find((item) => item.a_id === a.a_id);
          if (b) {
            const doc = csvDb.documents.find((d) => d.a_id === a.a_id);
            const rawType = b.b_type || 'Custom Bullion';

            // Find payments related to this bullion
            const bulPayments = csvDb.payments.filter((p) => p.a_id === b.a_id);
            const paidPurchases = bulPayments.filter(
              (p) => p.payment_type === 'PURCHASE' && (p.status === 'PAID' || p.status === 'RECEIVED')
            );
            const initialPaid = paidPurchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const pendingPayment = bulPayments.find(
              (p) => p.payment_type === 'PURCHASE' && (p.status === 'PENDING' || p.status === 'OVERDUE')
            );
            const val = Number(b.purchase_value) || 0;
            const remaining = Math.max(0, val - initialPaid);
            const paymentDueDate = b.payment_due_date || pendingPayment?.due_date || '';

            let paymentStatus: 'completed' | 'pending' | 'missed' = 'completed';
            if (remaining > 0) {
              if (paymentDueDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = new Date(paymentDueDate);
                due.setHours(0, 0, 0, 0);
                paymentStatus = due < today ? 'missed' : 'pending';
              } else {
                paymentStatus = 'pending';
              }
            }

            const numWeight = b.weight !== undefined && (b.weight as unknown) !== '' ? Number(b.weight) : undefined;
            const weightUnit = b.weight_unit || 'g';
            const numRate = b.purchase_rate !== undefined && (b.purchase_rate as unknown) !== '' ? Number(b.purchase_rate) : undefined;
            const weightDisplay = b.weight_display || (numWeight ? `${numWeight} ${weightUnit}` : undefined);
            const weightGrams = numWeight ? convertToGrams(numWeight, weightUnit) : undefined;

            memberBul.push({
              id: b.b_id,
              a_id: b.a_id,
              type: rawType,
              typeName: rawType,
              itemName: a.asset_name || rawType,
              purchaseDate: b.purchase_date,
              purchaseRate: numRate,
              weight: numWeight,
              weightUnit,
              weightGrams,
              weightDisplay,
              investedValue: val,
              status: b.b_status === 'SOLD' ? 'sold' : 'active',
              photoUrl: doc?.d_link || '',
              initialPayment: initialPaid,
              paymentDueDate,
              remainingPayment: remaining,
              paymentStatus
            });
          }
        }
      }

      // 4. Properties
      const memberProps: PropertyRecord[] = [];
      for (const a of memberAssets) {
        if (a.asset_type === 'REAL_ESTATE') {
          const prop = csvDb.properties.find((p) => p.a_id === a.a_id);
          if (prop) {
            const propPending = csvDb.payments.find(
              (p) => p.a_id === a.a_id && p.payment_type === 'PURCHASE' && p.due_date
            );
            memberProps.push({
              ...prop,
              property_status: (a.asset_status as 'ACTIVE' | 'SOLD' | 'DELETED') || 'ACTIVE',
              payment_deadline: prop.payment_deadline || propPending?.due_date || ''
            });
          }
        }
      }

      // 5. Rents
      const propIdSet = new Set(memberProps.map((p) => p.p_id));
      const memberRents = csvDb.rents.filter((r) => propIdSet.has(r.p_id));

      // 6. Payments
      const memberPayments = csvDb.payments.filter((p) => assetIds.has(p.a_id));

      // 7. Documents
      const memberDocs = csvDb.documents.filter((d) => assetIds.has(d.a_id));

      // 8. Realized Funds (Derived from payments.csv where payment_type = RECEIVED and payment_context in ['SALE', 'MATURITY'])
      // Strictly do not include RENT payments.
      const memberReceivedPayments = memberPayments.filter(
        (p) =>
          p.payment_type === 'RECEIVED' &&
          (p.payment_context === 'SALE' || p.payment_context === 'MATURITY') &&
          (p.status === 'RECEIVED' || p.status === 'PAID')
      );

      const memberRealized: RealizedFund[] = memberReceivedPayments.map((p) => {
        const asset = csvDb.assets.find((ast) => ast.a_id === p.a_id);
        let sourceCategory: RealizedSourceCategory = 'Other';
        if (asset?.asset_type === 'REAL_ESTATE') sourceCategory = 'Real Estate';
        else if (asset?.asset_type === 'FD') sourceCategory = 'FD';
        else if (asset?.asset_type === 'POST_OFFICE') sourceCategory = 'Post Office';
        else if (asset?.asset_type === 'BULLION') sourceCategory = 'Bullions';

        const reasonFormatted: RealizedReason =
          p.payment_context === 'SALE'
            ? 'Sold'
            : p.payment_context === 'MATURITY'
            ? 'Matured'
            : 'Other';

        return {
          id: p.payment_id,
          amount: Number(p.amount) || 0,
          sourceCategory,
          sourceName: asset?.asset_name || 'Realized Asset',
          dateReceived: p.payment_date,
          reason: reasonFormatted,
          remarks: p.notes || `Proceeds received from ${asset?.asset_name || 'Asset'}`,
          sourceInvestmentId: p.a_id
        };
      });

      // Calculate totals
      const activePoTotal = memberPo
        .filter((po) => po.status === 'active')
        .reduce((sum, po) => sum + (Number(po.amount) || 0), 0);
      const activeBulTotal = memberBul
        .filter((b) => b.status === 'active')
        .reduce((sum, b) => sum + getEffectiveBullionValue(b), 0);
      const activePropTotal = memberProps
        .filter((p) => p.property_status === 'ACTIVE')
        .reduce((sum, p) => sum + (Number(p.purchase_price) || 0), 0);
      const realizedTotal = memberRealized.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      return {
        id: m.member_id,
        name: m.member_name,
        role: 'Family Member',
        avatar: '🧑',
        otherAssets: {
          postOffice: activePoTotal,
          stocksMf: 0,
          realEstate: activePropTotal,
          bullions: activeBulTotal,
          realizedFunds: realizedTotal,
          cashInHand: 0
        },
        fds: memberFds,
        postOfficeInvestments: memberPo,
        bullionsInvestments: memberBul,
        properties: memberProps,
        rents: memberRents,
        propertyDocuments: memberDocs,
        propertyPayments: memberPayments,
        realizedFunds: memberRealized
      };
    });
  }, [dataRevision, midnightTicker, now]);

  // Fallback empty member when 0 family members exist in CSV
  const defaultEmptyMember: FamilyMember = useMemo(() => ({
    id: '',
    name: 'Empty Vault',
    role: 'No Members Added',
    avatar: '🧑',
    otherAssets: {
      postOffice: 0,
      stocksMf: 0,
      realEstate: 0,
      bullions: 0,
      realizedFunds: 0,
      cashInHand: 0
    },
    fds: [],
    postOfficeInvestments: [],
    bullionsInvestments: [],
    properties: [],
    rents: [],
    propertyDocuments: [],
    propertyPayments: [],
    realizedFunds: []
  }), []);

  const activeMember: FamilyMember = useMemo(() => {
    if (members.length === 0) return defaultEmptyMember;
    const found = members.find((m) => m.id === activeMemberId);
    return found || members[0];
  }, [members, activeMemberId, defaultEmptyMember]);

  const login = (pin: string): boolean => {
    if (pin.trim().length >= 4) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const clearAllData = async (): Promise<void> => {
    // Clear all CSV files to 0 rows (headers only)
    await csvDb.clearAll();
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_MEMBER_ID);
    setActiveMemberIdState('');
    bumpRevision();
  };

  const resetDemoData = async () => {
    await clearAllData();
  };

  const setActiveMemberId = (id: string) => {
    setActiveMemberIdState(id);
  };

  const addMember = (name: string, role?: string, avatar?: string): FamilyMember => {
    const member_id = `mem_${Date.now()}`;
    const newMemberRecord = {
      member_id,
      member_name: name.trim()
    };

    csvDb.addFamilyMember(newMemberRecord);
    setActiveMemberIdState(member_id);
    bumpRevision();

    return {
      id: member_id,
      name: name.trim(),
      role: role || 'Family Member',
      avatar: avatar || '🧑',
      otherAssets: {
        postOffice: 0,
        stocksMf: 0,
        realEstate: 0,
        bullions: 0,
        realizedFunds: 0,
        cashInHand: 0
      },
      fds: [],
      postOfficeInvestments: [],
      bullionsInvestments: [],
      properties: [],
      rents: [],
      propertyDocuments: [],
      propertyPayments: [],
      realizedFunds: []
    };
  };

  // ============================================================================
  // Fixed Deposits (fds.csv, assets.csv, documents.csv)
  // ============================================================================

  const addOrUpdateFd = (fdData: Partial<FixedDeposit>): FixedDeposit => {
    const id = fdData.id;
    let savedRecord: FdRecord;
    const currentMemberId = activeMember.id || (members[0]?.id ?? 'mem_default');

    if (id && csvDb.fds.some((f) => f.fd_id === id)) {
      const existing = csvDb.fds.find((f) => f.fd_id === id)!;
      savedRecord = {
        fd_id: existing.fd_id,
        a_id: existing.a_id || fdData.a_id || `ast_fd_${existing.fd_id}`,
        bank_name: (fdData.bankName !== undefined ? fdData.bankName : existing.bank_name).trim(),
        acc_number: (fdData.accountNumber !== undefined ? fdData.accountNumber : existing.acc_number).trim(),
        principal: fdData.principal !== undefined ? Number(fdData.principal) : existing.principal,
        interest_rate: fdData.interestRate !== undefined ? Number(fdData.interestRate) : (existing.interest_rate || existing.interest || 0),
        start_date: fdData.startDate !== undefined ? fdData.startDate : existing.start_date,
        maturity_date: fdData.maturityDate !== undefined ? fdData.maturityDate : (existing.maturity_date || existing.end_date || ''),
        actual_end_date: fdData.actualEndDate !== undefined ? fdData.actualEndDate : existing.actual_end_date
      };
      csvDb.updateFd(id, savedRecord);

      const assetStatus: AssetStatus = savedRecord.actual_end_date ? 'REDEEMED' : 'ACTIVE';
      csvDb.updateAsset(savedRecord.a_id, {
        asset_name: `${savedRecord.bank_name} FD`,
        asset_status: assetStatus
      });
    } else {
      const fd_id = id || `fd_${Date.now()}`;
      const a_id = fdData.a_id || `ast_fd_${fd_id}`;
      savedRecord = {
        fd_id,
        a_id,
        bank_name: (fdData.bankName || 'Other Bank').trim(),
        acc_number: (fdData.accountNumber || `•••• ${Math.floor(1000 + Math.random() * 9000)}`).trim(),
        principal: Number(fdData.principal) || 0,
        interest_rate: Number(fdData.interestRate) || 0,
        start_date: fdData.startDate || todayStr,
        maturity_date: fdData.maturityDate || todayStr,
        actual_end_date: fdData.actualEndDate || ''
      };

      // Add to assets.csv
      const assetStatus: AssetStatus = savedRecord.actual_end_date ? 'REDEEMED' : 'ACTIVE';
      csvDb.addAsset({
        a_id,
        member_id: currentMemberId,
        asset_type: 'FD',
        asset_name: `${savedRecord.bank_name} FD`,
        asset_status: assetStatus
      });

      // Add to fds.csv
      csvDb.addFd(savedRecord);
    }

    // Attach or update photo certificate in documents.csv
    if (fdData.photoUrl) {
      const existingDoc = csvDb.documents.find((d) => d.a_id === savedRecord.a_id || d.fd_id === savedRecord.fd_id);
      if (existingDoc) {
        csvDb.deleteDocument(existingDoc.d_id);
      }
      csvDb.addDocument({
        d_id: `doc_fd_${Date.now()}`,
        a_id: savedRecord.a_id,
        r_id: '',
        d_category: 'FD',
        d_name: (fdData as any).photoDocName?.trim() || `${savedRecord.bank_name} Certificate`,
        d_link: fdData.photoUrl,
        fd_id: savedRecord.fd_id
      });
    }

    // If actual_end_date is set, sync redemption to payments.csv (payment_type = RECEIVED)
    if (savedRecord.actual_end_date && savedRecord.actual_end_date.trim() !== '') {
      const existingPayment = csvDb.payments.find(
        (p) => p.a_id === savedRecord.a_id && p.payment_type === 'RECEIVED'
      );
      if (!existingPayment) {
        csvDb.addPayment({
          payment_id: `pay_fd_${savedRecord.fd_id}`,
          a_id: savedRecord.a_id,
          payment_type: 'RECEIVED',
          payment_context: 'MATURITY',
          amount: savedRecord.principal,
          payment_date: savedRecord.actual_end_date,
          due_date: '',
          status: 'RECEIVED',
          notes: `FD maturity/redemption proceeds from ${savedRecord.bank_name}`
        });
      }
    }

    bumpRevision();
    const doc = csvDb.documents.find((d) => d.a_id === savedRecord.a_id || d.fd_id === savedRecord.fd_id);
    return fdRecordToFixedDeposit(savedRecord, doc?.d_link);
  };

  const deleteFd = (id: string) => {
    const fd = csvDb.fds.find((f) => f.fd_id === id);
    csvDb.deleteFd(id);
    const fdDocs = csvDb.documents.filter((d) => (fd && d.a_id === fd.a_id) || d.fd_id === id);
    fdDocs.forEach((d) => csvDb.deleteDocument(d.d_id));
    bumpRevision();
  };

  const getFdById = (id: string): FixedDeposit | undefined => {
    const f = csvDb.fds.find((record) => record.fd_id === id);
    if (!f) return undefined;
    const doc = csvDb.documents.find((d) => d.a_id === f.a_id || d.fd_id === f.fd_id);
    return fdRecordToFixedDeposit(f, doc?.d_link);
  };

  // ============================================================================
  // Post Office (post_office.csv, assets.csv, documents.csv, contributions.csv)
  // ============================================================================

  const addOrUpdatePostOffice = (
    poData: Partial<PostOfficeInvestment> & { initialPaidMonths?: number }
  ): PostOfficeInvestment => {
    const id = poData.id;
    const currentMemberId = activeMember.id || (members[0]?.id ?? 'mem_default');

    let po_id = id;
    let a_id = poData.accountNumber ? `ast_po_${poData.accountNumber}` : `ast_po_${Date.now()}`;

    const existingPo = po_id ? csvDb.postOffice.find((p) => p.po_id === po_id) : undefined;
    const schemeType = poData.schemeType || 'TD';
    const isRd =
      schemeType === 'RD' ||
      (poData.schemeName
        ? poData.schemeName.includes('(RD)') || poData.schemeName.toLowerCase().includes('recurring')
        : false);

    if (existingPo) {
      a_id = existingPo.a_id;
      const updatedPo = {
        po_id: existingPo.po_id,
        a_id,
        scheme_name: poData.schemeName || existingPo.scheme_name,
        account_number: poData.accountNumber || existingPo.account_number,
        principal: isRd ? '' : (poData.amount !== undefined ? Number(poData.amount) : existingPo.principal),
        interest_rate: poData.interestRate !== undefined ? Number(poData.interestRate) : existingPo.interest_rate,
        start_date: poData.openingDate || existingPo.start_date,
        maturity_date: poData.maturityDate || existingPo.maturity_date,
        actual_end_date: poData.actualEndDate || existingPo.actual_end_date,
        scheme_status: (poData.status || existingPo.scheme_status || 'ACTIVE').toUpperCase()
      };
      csvDb.updatePostOffice(existingPo.po_id, updatedPo);
      csvDb.updateAsset(a_id, {
        asset_name: updatedPo.scheme_name,
        asset_status: updatedPo.scheme_status as AssetStatus
      });
      po_id = existingPo.po_id;
    } else {
      po_id = `po_${Date.now()}`;
      a_id = `ast_po_${po_id}`;
      const schemeStatus = (poData.status || 'ACTIVE').toUpperCase();

      csvDb.addAsset({
        a_id,
        member_id: currentMemberId,
        asset_type: 'POST_OFFICE',
        asset_name: poData.schemeName || 'Post Office Scheme',
        asset_status: schemeStatus as AssetStatus
      });

      csvDb.addPostOffice({
        po_id,
        a_id,
        scheme_name: poData.schemeName || 'Post Office Scheme',
        account_number: poData.accountNumber || `PO-${Math.floor(10000 + Math.random() * 90000)}`,
        principal: isRd ? '' : (Number(poData.amount) || 0),
        interest_rate: Number(poData.interestRate) || 0,
        start_date: poData.openingDate || todayStr,
        maturity_date: poData.maturityDate || todayStr,
        actual_end_date: poData.actualEndDate || '',
        scheme_status: schemeStatus
      });

      // If RD, generate recurring monthly schedule into contributions.csv
      const rdMonthly = Number(poData.monthlyDeposit || (poData as any).monthlyInstallment) || 0;
      if (isRd && rdMonthly > 0) {
        const initialPaid = poData.initialPaidMonths !== undefined ? Number(poData.initialPaidMonths) : 1;
        const schedule = generateRdSchedule(
          a_id,
          rdMonthly,
          poData.openingDate || todayStr,
          initialPaid,
          60,
          now
        );
        csvDb.addContributions(schedule);
      }
    }

    if (poData.photoUrl) {
      const existingDoc = csvDb.documents.find((d) => d.a_id === a_id);
      if (existingDoc) {
        csvDb.deleteDocument(existingDoc.d_id);
      }
      csvDb.addDocument({
        d_id: `doc_po_${Date.now()}`,
        a_id,
        r_id: '',
        d_category: 'POST_OFFICE',
        d_name: (poData as any).photoDocName?.trim() || `${poData.schemeName || 'PO'} Certificate`,
        d_link: poData.photoUrl
      });
    }

    bumpRevision();

    return {
      id: po_id,
      a_id,
      schemeType,
      schemeName: poData.schemeName || 'Post Office Scheme',
      accountNumber: poData.accountNumber || '',
      amount: Number(poData.amount) || 0,
      openingDate: poData.openingDate || '',
      maturityDate: poData.maturityDate || '',
      interestRate: Number(poData.interestRate) || 0,
      status: (poData.status || 'active').toLowerCase() as 'active' | 'matured' | 'redeemed' | 'closed',
      photoUrl: poData.photoUrl
    };
  };

  const deletePostOffice = (id: string) => {
    const po = csvDb.postOffice.find((p) => p.po_id === id);
    if (po) {
      csvDb.deletePostOffice(id);
      csvDb.deleteContributionsForAsset(po.a_id);
      const docs = csvDb.documents.filter((d) => d.a_id === po.a_id);
      docs.forEach((d) => csvDb.deleteDocument(d.d_id));
      csvDb.deleteAsset(po.a_id);
    }
    bumpRevision();
  };

  const getPostOfficeById = (id: string): PostOfficeInvestment | undefined => {
    return activeMember.postOfficeInvestments?.find((p) => p.id === id);
  };

  const getContributionsForPostOffice = (po_id: string): ContributionRecord[] => {
    const po = csvDb.postOffice.find((p) => p.po_id === po_id);
    if (!po) return [];
    return csvDb.getContributionsForAsset(po.a_id);
  };

  const recordRdContributionPayment = async (contribution_id: string, payment_date?: string): Promise<void> => {
    const datePaid = payment_date || todayStr;
    await csvDb.updateContribution(contribution_id, {
      status: 'PAID',
      payment_date: datePaid
    });
    bumpRevision();
  };

  const updateRdContribution = async (
    contribution_id: string,
    updates: Partial<ContributionRecord>
  ): Promise<void> => {
    await csvDb.updateContribution(contribution_id, updates);
    bumpRevision();
  };

  // ============================================================================
  // Bullions (bullions.csv, assets.csv, documents.csv)
  // ============================================================================

  const addOrUpdateBullion = (bullionData: Partial<BullionInvestment>): BullionInvestment => {
    const id = bullionData.id;
    const currentMemberId = activeMember.id || (members[0]?.id ?? 'mem_default');

    let b_id = id;
    let a_id = `ast_bul_${Date.now()}`;
    const customType = (bullionData.typeName || bullionData.type || 'Custom Bullion').trim();
    const purchaseValue = bullionData.investedValue !== undefined ? Number(bullionData.investedValue) : 0;
    const purchaseDate = bullionData.purchaseDate || todayStr;
    const initialPay = bullionData.initialPayment !== undefined && !isNaN(Number(bullionData.initialPayment))
      ? Math.max(0, Number(bullionData.initialPayment))
      : 0;
    const paymentDueDate = bullionData.paymentDueDate || '';

    const existingBul = b_id ? csvDb.bullions.find((b) => b.b_id === b_id) : undefined;
    if (existingBul) {
      a_id = existingBul.a_id;
      const bStatus = bullionData.status === 'sold' ? 'SOLD' : 'HELD';
      const numWeight = bullionData.weight !== undefined ? Number(bullionData.weight) : (bullionData.weightGrams !== undefined ? Number(bullionData.weightGrams) : existingBul.weight);
      const weightUnit = bullionData.weightUnit || existingBul.weight_unit || 'g';
      const numRate = bullionData.purchaseRate !== undefined ? Number(bullionData.purchaseRate) : existingBul.purchase_rate;
      const weightDisplay = bullionData.weightDisplay || (numWeight ? `${numWeight} ${weightUnit}` : existingBul.weight_display);

      csvDb.updateBullion(existingBul.b_id, {
        b_type: customType,
        purchase_value: bullionData.investedValue !== undefined ? Number(bullionData.investedValue) : existingBul.purchase_value,
        purchase_date: bullionData.purchaseDate || existingBul.purchase_date,
        b_status: bStatus,
        payment_due_date: paymentDueDate || existingBul.payment_due_date || '',
        weight: numWeight,
        weight_unit: weightUnit,
        purchase_rate: numRate,
        weight_display: weightDisplay
      });
      csvDb.updateAsset(a_id, {
        asset_name: bullionData.itemName || customType || 'Bullion Item',
        asset_status: bStatus === 'SOLD' ? 'SOLD' : 'ACTIVE'
      });
      b_id = existingBul.b_id;

      // Update or add pending payment if paymentDueDate provided
      const remaining = Math.max(0, (bullionData.investedValue !== undefined ? Number(bullionData.investedValue) : existingBul.purchase_value) - initialPay);
      const existingPending = csvDb.payments.find((p) => p.a_id === a_id && p.payment_type === 'PURCHASE' && p.status === 'PENDING');
      if (existingPending) {
        csvDb.updatePayment(existingPending.payment_id, {
          due_date: paymentDueDate,
          amount: remaining
        });
      } else if (paymentDueDate && remaining > 0) {
        csvDb.addPayment({
          payment_id: `pay_${Date.now()}_bul_due`,
          a_id,
          payment_type: 'PURCHASE',
          payment_context: 'PURCHASE',
          amount: remaining,
          payment_date: '',
          due_date: paymentDueDate,
          status: 'PENDING',
          notes: `Balance payment due for ${bullionData.itemName || customType}`
        });
      }
    } else {
      b_id = `bul_${Date.now()}`;
      a_id = `ast_bul_${b_id}`;
      const bStatus = bullionData.status === 'sold' ? 'SOLD' : 'HELD';
      const numWeight = bullionData.weight !== undefined ? Number(bullionData.weight) : (bullionData.weightGrams !== undefined ? Number(bullionData.weightGrams) : undefined);
      const weightUnit = bullionData.weightUnit || 'g';
      const numRate = bullionData.purchaseRate !== undefined ? Number(bullionData.purchaseRate) : undefined;
      const weightDisplay = bullionData.weightDisplay || (numWeight ? `${numWeight} ${weightUnit}` : undefined);

      csvDb.addAsset({
        a_id,
        member_id: currentMemberId,
        asset_type: 'BULLION',
        asset_name: bullionData.itemName || customType || 'Bullion Item',
        asset_status: bStatus === 'SOLD' ? 'SOLD' : 'ACTIVE'
      });

      csvDb.addBullion({
        b_id,
        a_id,
        b_type: customType,
        purchase_value: purchaseValue,
        purchase_date: purchaseDate,
        b_status: bStatus,
        payment_due_date: paymentDueDate,
        weight: numWeight,
        weight_unit: weightUnit,
        purchase_rate: numRate,
        weight_display: weightDisplay
      });

      // Track initial payment in payments.csv
      if (initialPay > 0) {
        csvDb.addPayment({
          payment_id: `pay_${Date.now()}_bul_init`,
          a_id,
          payment_type: 'PURCHASE',
          payment_context: 'PURCHASE',
          amount: initialPay,
          payment_date: purchaseDate,
          due_date: '',
          status: 'PAID',
          notes: `Initial payment for ${bullionData.itemName || customType}`
        });
      }

      // Track pending full payment due date in payments.csv
      const remaining = Math.max(0, purchaseValue - initialPay);
      if (paymentDueDate && remaining > 0) {
        csvDb.addPayment({
          payment_id: `pay_${Date.now()}_bul_due`,
          a_id,
          payment_type: 'PURCHASE',
          payment_context: 'PURCHASE',
          amount: remaining,
          payment_date: '',
          due_date: paymentDueDate,
          status: 'PENDING',
          notes: `Full balance payment due for ${bullionData.itemName || customType}`
        });
      }
    }

    if (bullionData.photoUrl) {
      const existingDoc = csvDb.documents.find((d) => d.a_id === a_id);
      if (existingDoc) {
        csvDb.deleteDocument(existingDoc.d_id);
      }
      csvDb.addDocument({
        d_id: `doc_bul_${Date.now()}`,
        a_id,
        r_id: '',
        d_category: 'BULLION',
        d_name: `${bullionData.itemName || customType} Invoice`,
        d_link: bullionData.photoUrl
      });
    }

    bumpRevision();

    const finalWeight = bullionData.weight !== undefined ? Number(bullionData.weight) : undefined;
    const finalUnit = bullionData.weightUnit || 'g';

    return {
      id: b_id,
      a_id,
      type: customType,
      typeName: customType,
      itemName: bullionData.itemName || customType,
      investedValue: purchaseValue,
      purchaseDate,
      purchaseRate: bullionData.purchaseRate !== undefined ? Number(bullionData.purchaseRate) : undefined,
      weight: finalWeight,
      weightUnit: finalUnit,
      weightGrams: finalWeight ? convertToGrams(finalWeight, finalUnit) : undefined,
      weightDisplay: bullionData.weightDisplay || (finalWeight ? `${finalWeight} ${finalUnit}` : undefined),
      status: bullionData.status || 'active',
      photoUrl: bullionData.photoUrl,
      initialPayment: initialPay,
      paymentDueDate,
      remainingPayment: Math.max(0, purchaseValue - initialPay)
    };
  };

  const deleteBullion = (id: string) => {
    csvDb.deleteBullion(id);
    bumpRevision();
  };

  const getBullionById = (id: string): BullionInvestment | undefined => {
    return activeMember.bullionsInvestments?.find((b) => b.id === id);
  };

  // ============================================================================
  // Properties, Rents, Payments, Documents (properties.csv, rents.csv, payments.csv, documents.csv)
  // ============================================================================

  const addProperty = (
    data: {
      p_type: PropertyType;
      name: string;
      location: string;
      area_sqft?: number | string;
      area_unit?: string;
      purchase_price: number;
      party_name: string;
      party_contact: string;
      purchase_date: string;
      p_notes?: string;
      initial_payment?: number;
      payment_deadline?: string;
    },
    documents?: { d_name: string; d_link: string }[]
  ): PropertyRecord => {
    const a_id = `ast_prop_${Date.now()}`;
    const p_id = `prop_${Date.now()}`;
    const currentMemberId = activeMember.id || (members[0]?.id ?? 'mem_default');
    const numInitialPayment =
      data.initial_payment !== undefined && !isNaN(Number(data.initial_payment))
        ? Math.max(0, Number(data.initial_payment))
        : 0;

    // 1. Add to assets.csv
    csvDb.addAsset({
      a_id,
      member_id: currentMemberId,
      asset_type: 'REAL_ESTATE',
      asset_name: data.name.trim(),
      asset_status: 'ACTIVE'
    });

    // 2. Add to properties.csv
    const newProp: PropertyRecord = {
      p_id,
      a_id,
      p_type: data.p_type,
      name: data.name.trim(),
      location: data.location.trim(),
      area_sqft: data.area_sqft !== undefined && data.area_sqft !== '' ? String(data.area_sqft).trim() : '',
      area_unit: data.area_unit ? String(data.area_unit).trim() : undefined,
      purchase_price: Number(data.purchase_price) || 0,
      party_name: data.party_name.trim(),
      party_contact: data.party_contact.trim(),
      purchase_date: data.purchase_date || todayStr,
      p_notes: data.p_notes?.trim() || '',
      property_status: 'ACTIVE',
      payment_deadline: data.payment_deadline || ''
    };
    csvDb.addProperty(newProp);

    // 3. Add initial purchase payment if any (track payments made for assets)
    if (numInitialPayment > 0) {
      csvDb.addPayment({
        payment_id: `pay_${Date.now()}_init`,
        a_id,
        payment_type: 'PURCHASE',
        payment_context: 'PURCHASE',
        amount: numInitialPayment,
        payment_date: data.purchase_date || todayStr,
        due_date: '',
        status: 'PAID',
        notes: 'Initial Payment / Down Payment',
        p_id
      });
    }

    // 4. Add pending balance payment due if deadline is given and remaining balance > 0
    const remainingBalance = Math.max(0, Number(data.purchase_price) - numInitialPayment);
    if (data.payment_deadline && remainingBalance > 0) {
      csvDb.addPayment({
        payment_id: `pay_${Date.now()}_bal`,
        a_id,
        payment_type: 'PURCHASE',
        payment_context: 'PURCHASE',
        amount: remainingBalance,
        payment_date: '',
        due_date: data.payment_deadline,
        status: 'PENDING',
        notes: 'Balance Purchase Payment Due',
        p_id
      });
    }

    // 5. Add documents if provided
    if (documents && documents.length > 0) {
      const newDocs: DocumentRecord[] = documents.map((doc, idx) => ({
        d_id: `doc_${Date.now()}_${idx}`,
        a_id,
        r_id: '',
        d_category: data.p_type,
        d_name: doc.d_name.trim(),
        d_link: doc.d_link || '',
        p_id
      }));
      csvDb.addDocuments(newDocs);
    }

    bumpRevision();
    return newProp;
  };

  const updateProperty = (p_id: string, data: Partial<PropertyRecord>) => {
    csvDb.updateProperty(p_id, data);
    const prop = csvDb.properties.find((p) => p.p_id === p_id);
    if (prop && data.name) {
      csvDb.updateAsset(prop.a_id, { asset_name: data.name });
    }
    bumpRevision();
  };

  const deleteProperty = (p_id: string) => {
    csvDb.deleteProperty(p_id);
    bumpRevision();
  };

  const getPropertyById = (p_id: string): PropertyRecord | undefined => {
    const p = csvDb.properties.find((prop) => prop.p_id === p_id);
    if (!p) return undefined;
    const asset = csvDb.assets.find((a) => a.a_id === p.a_id);
    const propPending = csvDb.payments.find(
      (pay) => pay.a_id === p.a_id && pay.payment_type === 'PURCHASE' && pay.due_date
    );
    return {
      ...p,
      property_status: (asset?.asset_status as any) || 'ACTIVE',
      payment_deadline: p.payment_deadline || propPending?.due_date || ''
    };
  };

  const startRent = (
    p_id: string,
    rentData: {
      tenant_name: string;
      tenant_contact: string;
      rent_amount: number;
      rent_start_date: string;
      rent_end_date?: string;
      next_rent_due: string;
      r_notes?: string;
    },
    documents?: { d_name: string; d_link: string }[]
  ): RentRecord => {
    const prop = csvDb.properties.find((p) => p.p_id === p_id);
    const a_id = prop?.a_id || `ast_${p_id}`;
    const r_id = `rent_${Date.now()}`;
    const newRent: RentRecord = {
      r_id,
      p_id,
      tenant_name: rentData.tenant_name.trim(),
      tenant_contact: rentData.tenant_contact.trim(),
      rent_amount: Number(rentData.rent_amount) || 0,
      rent_start_date: rentData.rent_start_date || todayStr,
      rent_end_date: rentData.rent_end_date || '',
      next_rent_due: rentData.next_rent_due || '',
      r_notes: rentData.r_notes?.trim() || ''
    };

    // Deactivate previous active rent if any
    const activePrev = csvDb.getActiveRentForProperty(p_id, now);
    if (activePrev) {
      csvDb.updateRent(activePrev.r_id, {
        rent_end_date: todayStr
      });
    }

    csvDb.addRent(newRent);

    const docsToSave = (documents && documents.length > 0) ? documents : ((rentData as any).documents || []);
    if (docsToSave && docsToSave.length > 0) {
      const newDocs: DocumentRecord[] = docsToSave.map((doc: any, idx: number) => ({
        d_id: `doc_${Date.now()}_${idx}`,
        a_id,
        r_id,
        d_category: 'RENT',
        d_name: doc.d_name.trim(),
        d_link: doc.d_link || '',
        p_id
      }));
      csvDb.addDocuments(newDocs);
    }

    bumpRevision();
    return newRent;
  };

  const stopRent = (r_id: string) => {
    csvDb.updateRent(r_id, {
      rent_end_date: todayStr
    });
    bumpRevision();
  };

  const getActiveRentForProperty = (p_id: string): RentRecord | undefined => {
    const active = csvDb.getActiveRentForProperty(p_id, now);
    if (!active) return undefined;
    return { ...active, is_active: true };
  };

  const getRentsForProperty = (p_id: string): RentRecord[] => {
    const today = todayStr;
    return csvDb.rents
      .filter((r) => r.p_id === p_id)
      .map((r) => ({
        ...r,
        is_active: !r.rent_end_date || r.rent_end_date >= today
      }));
  };

  const sellProperty = (
    p_id: string,
    saleData: {
      buyer_name: string;
      sale_price: number;
      sale_date: string;
      due_date?: string;
      amount_received: number;
      payment_status?: PaymentStatus;
      notes?: string;
      documents?: { d_name: string; d_link: string }[];
    }
  ) => {
    const prop = csvDb.properties.find((p) => p.p_id === p_id);
    if (!prop) return;
    const a_id = prop.a_id;

    // 1. Update status to SOLD in assets.csv
    csvDb.updateAsset(a_id, { asset_status: 'SOLD' });

    // 2. Close active rent if any
    const activeRent = csvDb.getActiveRentForProperty(p_id, now);
    if (activeRent) {
      csvDb.updateRent(activeRent.r_id, {
        rent_end_date: saleData.sale_date || todayStr
      });
    }

    // 3. Add to asset_sales.csv
    const sale_id = `sale_${Date.now()}`;
    const numSalePrice = Number(saleData.sale_price) || 0;
    const initialReceived = Number(saleData.amount_received) || 0;

    csvDb.addAssetSale({
      sale_id,
      a_id,
      buyer_name: saleData.buyer_name.trim(),
      buyer_contact: '',
      sale_price: numSalePrice,
      sale_date: saleData.sale_date || todayStr,
      payment_due_date: saleData.due_date || '',
      sale_notes: saleData.notes?.trim() || ''
    });

    // 4. Record payments in payments.csv (Single Source of Truth for money received)
    if (initialReceived > 0) {
      csvDb.addPayment({
        payment_id: `pay_${Date.now()}_sale_1`,
        a_id,
        payment_type: 'RECEIVED',
        payment_context: 'SALE',
        amount: initialReceived,
        payment_date: saleData.sale_date || todayStr,
        due_date: '',
        status: 'RECEIVED',
        notes: saleData.notes?.trim() || `Initial sale payment from buyer ${saleData.buyer_name}`,
        p_id
      });
    }

    // 5. Add documents if provided
    if (saleData.documents && saleData.documents.length > 0) {
      const newDocs: DocumentRecord[] = saleData.documents.map((doc, idx) => ({
        d_id: `doc_${Date.now()}_${idx}`,
        a_id,
        r_id: '',
        d_category: prop.p_type || 'OTHER',
        d_name: doc.d_name.trim(),
        d_link: doc.d_link || '',
        p_id
      }));
      csvDb.addDocuments(newDocs);
    }

    bumpRevision();
  };

  const recordPurchasePayment = (
    p_id: string,
    paymentData: {
      amount: number;
      payment_date: string;
      due_date?: string;
      status?: PaymentStatus;
      notes?: string;
    }
  ): PaymentRecord => {
    const prop = csvDb.properties.find((p) => p.p_id === p_id);
    const a_id = prop?.a_id || `ast_${p_id}`;
    const numAmount = Number(paymentData.amount) || 0;
    const paymentRecord: PaymentRecord = {
      payment_id: `pay_${Date.now()}`,
      a_id,
      payment_type: 'PURCHASE',
      payment_context: 'PURCHASE',
      amount: numAmount,
      payment_date: paymentData.payment_date || todayStr,
      due_date: paymentData.due_date || '',
      status: paymentData.status || 'PAID',
      notes: paymentData.notes?.trim() || 'Purchase installment payment',
      p_id
    };

    csvDb.addPayment(paymentRecord);
    bumpRevision();
    return paymentRecord;
  };

  const recordSalePayment = (
    p_id: string,
    paymentData: {
      amount: number;
      payment_date: string;
      due_date?: string;
      status?: PaymentStatus;
      notes?: string;
    }
  ): PaymentRecord => {
    const prop = csvDb.properties.find((p) => p.p_id === p_id);
    const a_id = prop?.a_id || `ast_${p_id}`;
    const numAmount = Number(paymentData.amount) || 0;
    const paymentRecord: PaymentRecord = {
      payment_id: `pay_${Date.now()}`,
      a_id,
      payment_type: 'RECEIVED',
      payment_context: 'SALE',
      amount: numAmount,
      payment_date: paymentData.payment_date || todayStr,
      due_date: paymentData.due_date || '',
      status: paymentData.status || 'RECEIVED',
      notes: paymentData.notes?.trim() || 'Sale receivable payment received',
      p_id
    };

    csvDb.addPayment(paymentRecord);
    bumpRevision();
    return paymentRecord;
  };

  const getPaymentsForProperty = (p_id: string): PaymentRecord[] => {
    const prop = csvDb.properties.find((p) => p.p_id === p_id);
    const a_id = prop?.a_id;
    return csvDb.payments.filter((p) => (a_id && p.a_id === a_id) || p.p_id === p_id);
  };

  const addDocument = (
    p_id: string,
    docData: {
      d_name: string;
      d_link: string;
      r_id?: string | null;
      d_category?: DocumentCategory;
    }
  ): DocumentRecord => {
    const prop = csvDb.properties.find((p) => p.p_id === p_id);
    const a_id = prop?.a_id || `ast_${p_id}`;
    const d_id = `doc_${Date.now()}`;
    const category: DocumentCategory =
      docData.d_category ||
      (docData.r_id ? 'RENT' : prop?.p_type === 'COMMERCIAL_PROPERTY' || prop?.p_type === 'Commercial Property' ? 'COMMERCIAL' : prop?.p_type === 'LAND' || prop?.p_type === 'Land' ? 'LAND' : 'PRIVATE_HOUSE');

    const newDoc: DocumentRecord = {
      d_id,
      a_id,
      r_id: docData.r_id || '',
      d_category: category,
      d_name: docData.d_name.trim(),
      d_link: docData.d_link || '',
      p_id
    };

    csvDb.addDocument(newDoc);
    bumpRevision();
    return newDoc;
  };

  const removeDocument = (d_id: string) => {
    csvDb.deleteDocument(d_id);
    bumpRevision();
  };

  const getDocumentsForProperty = (p_id: string): DocumentRecord[] => {
    return csvDb.getDocumentsForProperty(p_id);
  };

  const calculatePropertyFinances = (p_id: string) => {
    const finances = csvDb.calculatePropertyFinances(p_id, now);
    const isSold = getPropertyById(p_id)?.property_status === 'SOLD';
    return {
      totalPurchasePaid: finances.totalPurchasePaid,
      paymentLeft: finances.paymentLeft,
      totalSaleReceived: finances.totalSaleReceived,
      saleReceivableLeft: finances.saleReceivableLeft,
      nextDueDate: finances.nextDueDate,
      dueDateType: isSold
        ? ('sale_receivable_due' as const)
        : ('purchase_payment_due' as const),
      paymentStatus: finances.paymentStatus
    };
  };

  // ============================================================================
  // Realized Funds (Section 5: derived from payments.csv where payment_type = RECEIVED)
  // ============================================================================

  const addOrUpdateRealizedFund = (rfData: Partial<RealizedFund>): RealizedFund => {
    const payment_id = rfData.id || `pay_rf_${Date.now()}`;
    const a_id = rfData.sourceInvestmentId || `ast_rf_${Date.now()}`;
    const amount = Number(rfData.amount) || 0;
    const dateReceived = rfData.dateReceived || todayStr;
    const notes = rfData.remarks || `Proceeds from ${rfData.sourceName || 'Asset'}`;

    const existingPayment = csvDb.payments.find((p) => p.payment_id === payment_id);
    if (existingPayment) {
      csvDb.updatePayment(payment_id, {
        amount,
        payment_date: dateReceived,
        notes
      });
    } else {
      // Ensure asset exists in assets.csv
      const currentMemberId = activeMember.id || (members[0]?.id ?? 'mem_default');
      const existingAsset = csvDb.assets.find((a) => a.a_id === a_id);
      if (!existingAsset) {
        let astType: any = 'FD';
        if (rfData.sourceCategory === 'Post Office') astType = 'POST_OFFICE';
        else if (rfData.sourceCategory === 'Bullions') astType = 'BULLION';
        else if (rfData.sourceCategory === 'Real Estate') astType = 'REAL_ESTATE';

        csvDb.addAsset({
          a_id,
          member_id: currentMemberId,
          asset_type: astType,
          asset_name: rfData.sourceName || 'Asset',
          asset_status: (rfData.reason ? rfData.reason.toUpperCase() : 'MATURED') as AssetStatus
        });
      }

      const paymentContext: PaymentContext =
        rfData.sourceCategory === 'Real Estate' || rfData.reason === 'Sold' ? 'SALE' : 'MATURITY';

      csvDb.addPayment({
        payment_id,
        a_id,
        payment_type: 'RECEIVED',
        payment_context: paymentContext,
        amount,
        payment_date: dateReceived,
        due_date: '',
        status: 'RECEIVED',
        notes
      });
    }

    bumpRevision();

    return {
      id: payment_id,
      amount,
      sourceCategory: rfData.sourceCategory || 'Other',
      sourceName: rfData.sourceName || 'Realized Asset',
      dateReceived,
      reason: rfData.reason || 'Matured',
      remarks: notes,
      sourceInvestmentId: a_id
    };
  };

  const deleteRealizedFund = (id: string) => {
    csvDb.deletePayment(id);
    bumpRevision();
  };

  const getRealizedFundById = (id: string): RealizedFund | undefined => {
    return activeMember.realizedFunds?.find((r) => r.id === id);
  };

  const realizeInvestment = (payload: {
    sourceCategory: RealizedSourceCategory;
    sourceId: string;
    amount: number;
    dateReceived: string;
    reason: RealizedReason;
    remarks?: string;
  }): RealizedFund => {
    let a_id = payload.sourceId;

    if (payload.sourceCategory === 'FD') {
      const fd = csvDb.fds.find((f) => f.fd_id === payload.sourceId || f.a_id === payload.sourceId);
      if (fd) {
        a_id = fd.a_id;
        csvDb.updateFd(fd.fd_id, {
          actual_end_date: payload.dateReceived || todayStr
        });
        csvDb.updateAsset(fd.a_id, {
          asset_status: payload.reason === 'Matured' ? 'MATURED' : 'REDEEMED'
        });
      }
    } else if (payload.sourceCategory === 'Post Office') {
      const po = csvDb.postOffice.find((p) => p.po_id === payload.sourceId || p.a_id === payload.sourceId);
      if (po) {
        a_id = po.a_id;
        csvDb.updatePostOffice(po.po_id, {
          actual_end_date: payload.dateReceived || todayStr,
          scheme_status: payload.reason === 'Matured' ? 'MATURED' : 'REDEEMED'
        });
        csvDb.updateAsset(po.a_id, {
          asset_status: payload.reason === 'Matured' ? 'MATURED' : 'REDEEMED'
        });
      }
    } else if (payload.sourceCategory === 'Bullions') {
      const bul = csvDb.bullions.find((b) => b.b_id === payload.sourceId || b.a_id === payload.sourceId);
      if (bul) {
        a_id = bul.a_id;
        csvDb.updateBullion(bul.b_id, { b_status: 'SOLD' });
        csvDb.updateAsset(bul.a_id, { asset_status: 'SOLD' });
      }
    }

    const paymentContext: PaymentContext =
      payload.sourceCategory === 'Real Estate' || payload.reason === 'Sold' ? 'SALE' : 'MATURITY';

    const payRecord: PaymentRecord = {
      payment_id: `pay_rf_${Date.now()}`,
      a_id,
      payment_type: 'RECEIVED',
      payment_context: paymentContext,
      amount: payload.amount,
      payment_date: payload.dateReceived,
      due_date: '',
      status: 'RECEIVED',
      notes: payload.remarks || `Realized from ${payload.sourceCategory}`
    };

    csvDb.addPayment(payRecord);
    bumpRevision();

    return {
      id: payRecord.payment_id,
      amount: payload.amount,
      sourceCategory: payload.sourceCategory,
      sourceName: `Realized ${payload.sourceCategory}`,
      dateReceived: payload.dateReceived,
      reason: payload.reason,
      remarks: payload.remarks || '',
      sourceInvestmentId: a_id
    };
  };

  // ============================================================================
  // Portfolio Summary Calculations (Derived strictly from CSVs)
  // ============================================================================

  const getPortfolioSummary = (member?: FamilyMember): PortfolioSummary => {
    const target = member || activeMember;
    const targetMemberId = target.id;

    // Filter active assets for this member
    const targetAssets = csvDb.assets.filter(
      (a) => a.member_id === targetMemberId && a.asset_status !== 'DELETED'
    );
    const targetAssetIds = new Set(targetAssets.map((a) => a.a_id));

    // 1. FDs: active FDs
    const activeFdRecords = csvDb.fds.filter((f) => {
      const asset = csvDb.assets.find((a) => a.a_id === f.a_id);
      return (
        targetAssetIds.has(f.a_id) &&
        (!f.actual_end_date || f.actual_end_date.trim() === '') &&
        asset?.asset_status === 'ACTIVE'
      );
    });
    const fdTotal = activeFdRecords.reduce((sum, f) => sum + (Number(f.principal) || 0), 0);

    // 2. Post Office: active PO
    const activePoRecords = csvDb.postOffice.filter((p) => {
      const asset = csvDb.assets.find((a) => a.a_id === p.a_id);
      return (
        targetAssetIds.has(p.a_id) &&
        (!p.actual_end_date || p.actual_end_date.trim() === '') &&
        asset?.asset_status === 'ACTIVE'
      );
    });
    let postOfficeTotal = 0;
    for (const p of activePoRecords) {
      const sName = p.scheme_name.toLowerCase();
      const isRd = sName.includes('recurring') || sName.includes('(rd)');
      if (isRd) {
        const paidContribs = csvDb.contributions.filter((c) => c.a_id === p.a_id && c.status === 'PAID');
        postOfficeTotal += paidContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      } else {
        postOfficeTotal += Number(p.principal) || 0;
      }
    }

    // 3. Bullions: held Bullions
    const activeBulRecords = csvDb.bullions.filter((b) => {
      const asset = csvDb.assets.find((a) => a.a_id === b.a_id);
      return (
        targetAssetIds.has(b.a_id) &&
        b.b_status === 'HELD' &&
        asset?.asset_status === 'ACTIVE'
      );
    });
    const bullionsTotal = activeBulRecords.reduce((sum, b) => sum + (Number(b.purchase_value) || 0), 0);

    // 4. Real Estate: active properties
    const activeProps = csvDb.properties.filter((p) => {
      const asset = csvDb.assets.find((a) => a.a_id === p.a_id);
      return targetAssetIds.has(p.a_id) && asset?.asset_status === 'ACTIVE';
    });
    const realEstateTotal = activeProps.reduce((sum, p) => sum + (Number(p.purchase_price) || 0), 0);

    // 5. Realized Funds: derived strictly from payments.csv where payment_type = RECEIVED and payment_context in ['SALE', 'MATURITY']
    const realizedPayments = csvDb.payments.filter(
      (p) =>
        targetAssetIds.has(p.a_id) &&
        p.payment_type === 'RECEIVED' &&
        (p.payment_context === 'SALE' || p.payment_context === 'MATURITY') &&
        (p.status === 'RECEIVED' || p.status === 'PAID')
    );
    const realizedFundsTotal = realizedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const stocksMf = 0;
    const activeInvestmentsTotal = fdTotal + postOfficeTotal + bullionsTotal + realEstateTotal + stocksMf;
    const total = activeInvestmentsTotal + realizedFundsTotal;

    // Upcoming maturities from active FDs & Post Office
    let upcomingMaturitiesCount = 0;
    let nextMaturityDays: number | null = null;
    const now = new Date().getTime();

    activeFdRecords.forEach((f) => {
      const matDateStr = f.maturity_date || f.end_date;
      if (matDateStr) {
        const mat = new Date(matDateStr).getTime();
        const diffDays = Math.ceil((mat - now) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 90) {
          upcomingMaturitiesCount++;
        }
        if (diffDays >= 0) {
          if (nextMaturityDays === null || diffDays < nextMaturityDays) {
            nextMaturityDays = diffDays;
          }
        }
      }
    });

    activePoRecords.forEach((p) => {
      if (p.maturity_date) {
        const mat = new Date(p.maturity_date).getTime();
        const diffDays = Math.ceil((mat - now) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 90) {
          upcomingMaturitiesCount++;
        }
        if (diffDays >= 0) {
          if (nextMaturityDays === null || diffDays < nextMaturityDays) {
            nextMaturityDays = diffDays;
          }
        }
      }
    });

    return {
      total,
      totalNetWorth: total,
      activeInvestmentsTotal,
      realizedFundsTotal,
      fdTotal,
      postOfficeTotal,
      bullionsTotal,
      realEstateTotal,
      stocksTotal: stocksMf,
      realizedTotal: realizedFundsTotal,
      upcomingMaturitiesCount,
      nextMaturityDays,
      breakdown: {
        fds: fdTotal,
        postOffice: postOfficeTotal,
        stocksMf,
        realEstate: realEstateTotal,
        bullions: bullionsTotal,
        realizedFunds: realizedFundsTotal
      }
    };
  };

  const allPropertiesWithStatus: PropertyRecord[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dataRevision;
    return csvDb.properties.map((p) => {
      const asset = csvDb.assets.find((a) => a.a_id === p.a_id);
      const status: PropertyStatus = (asset?.asset_status as PropertyStatus) || 'ACTIVE';
      const propPending = csvDb.payments.find(
        (pay) => pay.a_id === p.a_id && pay.payment_type === 'PURCHASE' && pay.due_date
      );
      return {
        ...p,
        property_status: status,
        payment_deadline: p.payment_deadline || propPending?.due_date || ''
      };
    });
  }, [dataRevision]);

  return (
    <InvestmentContext.Provider
      value={{
        members,
        activeMember,
        activeMemberId,
        isAuthenticated,
        isCsvLoaded,
        login,
        logout,
        resetDemoData,
        clearAllData,
        setActiveMemberId,
        addMember,
        fds: csvDb.fds,
        addOrUpdateFd,
        deleteFd,
        getFdById,
        addOrUpdatePostOffice,
        deletePostOffice,
        getPostOfficeById,
        getContributionsForPostOffice,
        recordRdContributionPayment,
        updateRdContribution,
        addOrUpdateBullion,
        deleteBullion,
        getBullionById,
        properties: allPropertiesWithStatus,
        rents: csvDb.rents,
        propertyDocuments: csvDb.documents,
        propertyPayments: csvDb.payments,
        realisedFunds: activeMember.realizedFunds || [],
        addProperty,
        updateProperty,
        deleteProperty,
        getPropertyById,
        startRent,
        stopRent,
        getActiveRentForProperty,
        getRentsForProperty,
        sellProperty,
        recordPurchasePayment,
        recordSalePayment,
        getPaymentsForProperty,
        addDocument,
        removeDocument,
        getDocumentsForProperty,
        calculatePropertyFinances,
        addOrUpdateRealizedFund,
        deleteRealizedFund,
        getRealizedFundById,
        realizeInvestment,
        getPortfolioSummary
      }}
    >
      {children}
    </InvestmentContext.Provider>
  );
};

export const useInvestments = (): InvestmentContextType => {
  const context = useContext(InvestmentContext);
  if (!context) {
    throw new Error('useInvestments must be used within an InvestmentProvider');
  }
  return context;
};
