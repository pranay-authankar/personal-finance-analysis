import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  FamilyMember,
  FixedDeposit,
  PostOfficeInvestment,
  BullionInvestment,
  RealizedFund,
  RealizedSourceCategory,
  RealizedReason,
  PortfolioSummary
} from '../types';
import { DEFAULT_SEED_MEMBERS } from '../data/seedData';
import { getEffectiveBullionValue } from '../utils/bullionCalculations';

const STORAGE_KEYS = {
  MEMBERS: 'familyvault_members_data_v4', // v4 to include realized funds
  ACTIVE_MEMBER_ID: 'familyvault_active_member_id',
  IS_AUTHENTICATED: 'familyvault_authenticated'
};

interface InvestmentContextType {
  members: FamilyMember[];
  activeMember: FamilyMember;
  activeMemberId: string;
  isAuthenticated: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  resetDemoData: () => void;
  setActiveMemberId: (id: string) => void;
  addMember: (name: string, role: string, avatar: string) => FamilyMember;

  // Fixed Deposits
  addOrUpdateFd: (fd: Partial<FixedDeposit>) => FixedDeposit;
  deleteFd: (id: string) => void;
  getFdById: (id: string) => FixedDeposit | undefined;

  // Post Office Investments
  addOrUpdatePostOffice: (po: Partial<PostOfficeInvestment>) => PostOfficeInvestment;
  deletePostOffice: (id: string) => void;
  getPostOfficeById: (id: string) => PostOfficeInvestment | undefined;

  // Bullions Investments
  addOrUpdateBullion: (b: Partial<BullionInvestment>) => BullionInvestment;
  deleteBullion: (id: string) => void;
  getBullionById: (id: string) => BullionInvestment | undefined;

  // Realized Funds
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

  // Calculations
  getPortfolioSummary: (member?: FamilyMember) => PortfolioSummary;
}

const InvestmentContext = createContext<InvestmentContextType | undefined>(undefined);

export const InvestmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<FamilyMember[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      return stored ? JSON.parse(stored) : DEFAULT_SEED_MEMBERS;
    } catch {
      return DEFAULT_SEED_MEMBERS;
    }
  });

  const [activeMemberId, setActiveMemberIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_MEMBER_ID) || 'mem_dad';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED) === 'true';
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER_ID, activeMemberId);
  }, [activeMemberId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  const activeMember = members.find((m) => m.id === activeMemberId) || members[0] || DEFAULT_SEED_MEMBERS[0];

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

  const resetDemoData = () => {
    setMembers(DEFAULT_SEED_MEMBERS);
    setActiveMemberIdState(DEFAULT_SEED_MEMBERS[0].id);
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(DEFAULT_SEED_MEMBERS));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER_ID, DEFAULT_SEED_MEMBERS[0].id);
  };

  const setActiveMemberId = (id: string) => {
    setActiveMemberIdState(id);
  };

  const addMember = (name: string, role: string, avatar: string): FamilyMember => {
    const newMember: FamilyMember = {
      id: `mem_${Date.now()}`,
      name: name.trim(),
      role: role.trim(),
      avatar: avatar || '🧑',
      otherAssets: {
        postOffice: 0,
        stocksMf: 0,
        realEstate: 0,
        bullions: 0,
        cashInHand: 0
      },
      fds: [],
      postOfficeInvestments: [],
      bullionsInvestments: []
    };

    setMembers((prev) => [...prev, newMember]);
    setActiveMemberIdState(newMember.id);
    return newMember;
  };

  // Fixed Deposits
  const addOrUpdateFd = (fdData: Partial<FixedDeposit>): FixedDeposit => {
    let savedFd: FixedDeposit;

    setMembers((prevMembers) => {
      return prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;

        const fds = [...(member.fds || [])];
        if (fdData.id) {
          const index = fds.findIndex((f) => f.id === fdData.id);
          if (index !== -1) {
            savedFd = { ...fds[index], ...fdData } as FixedDeposit;
            fds[index] = savedFd;
          } else {
            savedFd = fdData as FixedDeposit;
            fds.push(savedFd);
          }
        } else {
          savedFd = {
            id: `fd_${Date.now()}`,
            bankName: fdData.bankName || 'Other Bank',
            accountNumber: fdData.accountNumber || `•••• ${Math.floor(1000 + Math.random() * 9000)}`,
            principal: Number(fdData.principal) || 0,
            interestRate: Number(fdData.interestRate) || 0,
            startDate: fdData.startDate || new Date().toISOString().split('T')[0],
            maturityDate: fdData.maturityDate || new Date().toISOString().split('T')[0],
            photoUrl: fdData.photoUrl || ''
          };
          fds.push(savedFd);
        }

        return { ...member, fds };
      });
    });

    return savedFd!;
  };

  const deleteFd = (id: string) => {
    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;
        return {
          ...member,
          fds: (member.fds || []).filter((f) => f.id !== id)
        };
      })
    );
  };

  const getFdById = (id: string): FixedDeposit | undefined => {
    return activeMember.fds?.find((f) => f.id === id);
  };

  // Post Office Investments
  const addOrUpdatePostOffice = (poData: Partial<PostOfficeInvestment>): PostOfficeInvestment => {
    let savedPo: PostOfficeInvestment;

    setMembers((prevMembers) => {
      return prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;

        const pos = [...(member.postOfficeInvestments || [])];
        if (poData.id) {
          const index = pos.findIndex((p) => p.id === poData.id);
          if (index !== -1) {
            savedPo = { ...pos[index], ...poData } as PostOfficeInvestment;
            pos[index] = savedPo;
          } else {
            savedPo = poData as PostOfficeInvestment;
            pos.push(savedPo);
          }
        } else {
          savedPo = {
            id: `po_${Date.now()}`,
            schemeType: poData.schemeType || 'POTD',
            schemeName: poData.schemeName || 'Post Office Scheme',
            accountNumber: poData.accountNumber || `PO-${Math.floor(10000 + Math.random() * 90000)}`,
            amount: Number(poData.amount) || 0,
            openingDate: poData.openingDate || new Date().toISOString().split('T')[0],
            maturityDate: poData.maturityDate || new Date().toISOString().split('T')[0],
            interestRate: poData.interestRate !== undefined ? Number(poData.interestRate) : undefined,
            branch: poData.branch || 'Head Post Office',
            nominee: poData.nominee || '',
            photoUrl: poData.photoUrl || '',
            monthlyInstallment: poData.monthlyInstallment,
            monthlyPayout: poData.monthlyPayout,
            quarterlyPayout: poData.quarterlyPayout,
            tenureYears: poData.tenureYears,
            financialYearContribution: poData.financialYearContribution,
            currentBalance: poData.currentBalance,
            girlChildName: poData.girlChildName,
            girlChildDob: poData.girlChildDob,
            guardianName: poData.guardianName,
            maturityAmount: poData.maturityAmount
          };
          pos.push(savedPo);
        }

        const newPostOfficeTotal = pos.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const updatedOtherAssets = {
          ...(member.otherAssets || { stocksMf: 0, realEstate: 0, bullions: 0, cashInHand: 0 }),
          postOffice: newPostOfficeTotal
        };

        return { ...member, postOfficeInvestments: pos, otherAssets: updatedOtherAssets };
      });
    });

    return savedPo!;
  };

  const deletePostOffice = (id: string) => {
    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;
        const pos = (member.postOfficeInvestments || []).filter((p) => p.id !== id);
        const newPostOfficeTotal = pos.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return {
          ...member,
          postOfficeInvestments: pos,
          otherAssets: {
            ...(member.otherAssets || { stocksMf: 0, realEstate: 0, bullions: 0, cashInHand: 0 }),
            postOffice: newPostOfficeTotal
          }
        };
      })
    );
  };

  const getPostOfficeById = (id: string): PostOfficeInvestment | undefined => {
    return activeMember.postOfficeInvestments?.find((p) => p.id === id);
  };

  // Bullions Investments
  const addOrUpdateBullion = (bData: Partial<BullionInvestment>): BullionInvestment => {
    let savedBul: BullionInvestment;

    setMembers((prevMembers) => {
      return prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;

        const buls = [...(member.bullionsInvestments || [])];
        if (bData.id) {
          const index = buls.findIndex((b) => b.id === bData.id);
          if (index !== -1) {
            savedBul = { ...buls[index], ...bData } as BullionInvestment;
            buls[index] = savedBul;
          } else {
            savedBul = bData as BullionInvestment;
            buls.push(savedBul);
          }
        } else {
          savedBul = {
            id: `bul_${Date.now()}`,
            type: bData.type || 'GOLD',
            typeName: bData.typeName || 'Gold',
            itemName: bData.itemName || 'Bullion Holding',
            purchaseDate: bData.purchaseDate || undefined,
            purchaseRate: bData.purchaseRate !== undefined ? Number(bData.purchaseRate) : undefined,
            weightGrams: bData.weightGrams !== undefined ? Number(bData.weightGrams) : undefined,
            weightDisplay: bData.weightDisplay || undefined,
            investedValue: bData.investedValue !== undefined ? Number(bData.investedValue) : undefined,
            photoUrl: bData.photoUrl || '',
            notes: bData.notes || ''
          };
          buls.push(savedBul);
        }

        // Only include items with sufficient value in otherAssets.bullions
        const newBullionsTotal = buls.reduce((sum, b) => {
          return sum + getEffectiveBullionValue(b);
        }, 0);

        const updatedOtherAssets = {
          ...(member.otherAssets || { postOffice: 0, stocksMf: 0, realEstate: 0, cashInHand: 0 }),
          bullions: newBullionsTotal
        };

        return { ...member, bullionsInvestments: buls, otherAssets: updatedOtherAssets };
      });
    });

    return savedBul!;
  };

  const deleteBullion = (id: string) => {
    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;
        const buls = (member.bullionsInvestments || []).filter((b) => b.id !== id);
        const newBullionsTotal = buls.reduce((sum, b) => {
          return sum + getEffectiveBullionValue(b);
        }, 0);

        return {
          ...member,
          bullionsInvestments: buls,
          otherAssets: {
            ...(member.otherAssets || { postOffice: 0, stocksMf: 0, realEstate: 0, cashInHand: 0 }),
            bullions: newBullionsTotal
          }
        };
      })
    );
  };

  const getBullionById = (id: string): BullionInvestment | undefined => {
    return activeMember.bullionsInvestments?.find((b) => b.id === id);
  };

  // Realized Funds Management
  const addOrUpdateRealizedFund = (rf: Partial<RealizedFund>): RealizedFund => {
    let savedRf: RealizedFund;

    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;

        const currentRfs = member.realizedFunds || [];
        const isEdit = Boolean(rf.id);

        if (isEdit) {
          savedRf = {
            ...(currentRfs.find((item) => item.id === rf.id) || {
              id: rf.id!,
              amount: 0,
              sourceCategory: 'Other',
              sourceName: '',
              dateReceived: new Date().toISOString().split('T')[0],
              reason: 'Other'
            }),
            ...rf
          } as RealizedFund;

          const updatedRfs = currentRfs.map((item) => (item.id === rf.id ? savedRf : item));
          return {
            ...member,
            realizedFunds: updatedRfs
          };
        } else {
          savedRf = {
            id: `rf_${Date.now()}`,
            amount: Number(rf.amount) || 0,
            sourceCategory: rf.sourceCategory || 'Other',
            sourceName: (rf.sourceName || '').trim(),
            dateReceived: rf.dateReceived || new Date().toISOString().split('T')[0],
            reason: rf.reason || 'Other',
            remarks: rf.remarks?.trim() || '',
            sourceInvestmentId: rf.sourceInvestmentId
          };

          return {
            ...member,
            realizedFunds: [savedRf, ...currentRfs]
          };
        }
      })
    );

    return savedRf!;
  };

  const deleteRealizedFund = (id: string) => {
    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;
        const rfs = (member.realizedFunds || []).filter((r) => r.id !== id);
        return {
          ...member,
          realizedFunds: rfs
        };
      })
    );
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
    let createdRf: RealizedFund;

    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;

        let updatedFds = member.fds || [];
        let updatedPos = member.postOfficeInvestments || [];
        let updatedBuls = member.bullionsInvestments || [];
        let defaultSourceName = '';

        if (payload.sourceCategory === 'FD') {
          const fd = updatedFds.find((f) => f.id === payload.sourceId);
          defaultSourceName = fd ? `FD — ${fd.bankName}` : 'Fixed Deposit';
          // Remove card completely from active Fixed Deposits
          updatedFds = updatedFds.filter((f) => f.id !== payload.sourceId);
        } else if (payload.sourceCategory === 'Post Office') {
          const po = updatedPos.find((p) => p.id === payload.sourceId);
          defaultSourceName = po ? `Post Office — ${po.schemeName}` : 'Post Office';
          // Remove card completely from active Post Office investments
          updatedPos = updatedPos.filter((p) => p.id !== payload.sourceId);
        } else if (payload.sourceCategory === 'Bullions') {
          const bul = updatedBuls.find((b) => b.id === payload.sourceId);
          defaultSourceName = bul ? `${bul.typeName} — ${bul.itemName}` : 'Bullion';
          // Remove card completely from active Bullions
          updatedBuls = updatedBuls.filter((b) => b.id !== payload.sourceId);
        } else {
          defaultSourceName = payload.sourceCategory;
        }

        createdRf = {
          id: `rf_${Date.now()}`,
          amount: Number(payload.amount) || 0,
          sourceCategory: payload.sourceCategory,
          sourceName: defaultSourceName,
          dateReceived: payload.dateReceived,
          reason: payload.reason,
          remarks: payload.remarks || '',
          sourceInvestmentId: payload.sourceId
        };

        const existingRfs = member.realizedFunds || [];
        return {
          ...member,
          fds: updatedFds,
          postOfficeInvestments: updatedPos,
          bullionsInvestments: updatedBuls,
          realizedFunds: [createdRf, ...existingRfs]
        };
      })
    );

    return createdRf!;
  };

  // Portfolio Summary Calculation (Active Investments + Realized Funds)
  const getPortfolioSummary = (memberTarget?: FamilyMember): PortfolioSummary => {
    const target = memberTarget || activeMember;
    if (!target) {
      return {
        total: 0,
        activeInvestmentsTotal: 0,
        fdTotal: 0,
        postOfficeTotal: 0,
        bullionsTotal: 0,
        realizedFundsTotal: 0,
        breakdown: { fds: 0, postOffice: 0, stocksMf: 0, realEstate: 0, bullions: 0, realizedFunds: 0 }
      };
    }

    // 1. Fixed Deposits: Only active deposits contribute to active FD valuation
    const fds = target.fds || [];
    const activeFds = fds.filter((f) => !f.status || f.status === 'active');
    const fdTotal = activeFds.reduce((sum, f) => sum + (Number(f.principal) || 0), 0);

    // 2. Post Office: Only active schemes contribute
    const poList = target.postOfficeInvestments || [];
    const activePos = poList.filter((p) => !p.status || p.status === 'active');
    const poCalculatedTotal = activePos.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const postOfficeTotal = poCalculatedTotal > 0
      ? poCalculatedTotal
      : (poList.length === 0 ? (target.otherAssets?.postOffice || 0) : 0);

    // 3. Bullions: Only active physical holdings with sufficient value contribute
    const bulList = target.bullionsInvestments || [];
    const activeBuls = bulList.filter((b) => !b.status || b.status === 'active');
    const bulCalculatedTotal = activeBuls.reduce((sum, b) => {
      return sum + getEffectiveBullionValue(b);
    }, 0);
    const bullionsTotal = activeBuls.length > 0
      ? bulCalculatedTotal
      : (bulList.length === 0 ? (target.otherAssets?.bullions || 0) : 0);

    // 4. Other Assets (Stocks & Real Estate)
    const o = target.otherAssets || { stocksMf: 0, realEstate: 0 };
    const stocksMf = o.stocksMf || 0;
    const realEstate = o.realEstate || 0;

    // 5. Realized Funds: Money received when an asset was sold, matured, or redeemed
    const rfList = target.realizedFunds || [];
    const rfCalculatedTotal = rfList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const realizedFundsTotal = rfList.length > 0
      ? rfCalculatedTotal
      : (target.otherAssets?.realizedFunds ?? target.otherAssets?.cashInHand ?? 0);

    // Overall Home Tracked Wealth = Active Investments + Realized Funds
    const activeInvestmentsTotal = fdTotal + postOfficeTotal + bullionsTotal + stocksMf + realEstate;
    const total = activeInvestmentsTotal + realizedFundsTotal;

    return {
      total,
      activeInvestmentsTotal,
      fdTotal,
      postOfficeTotal,
      bullionsTotal,
      realizedFundsTotal,
      breakdown: {
        fds: fdTotal,
        postOffice: postOfficeTotal,
        stocksMf,
        realEstate,
        bullions: bullionsTotal,
        realizedFunds: realizedFundsTotal
      }
    };
  };

  return (
    <InvestmentContext.Provider
      value={{
        members,
        activeMember,
        activeMemberId,
        isAuthenticated,
        login,
        logout,
        resetDemoData,
        setActiveMemberId,
        addMember,
        addOrUpdateFd,
        deleteFd,
        getFdById,
        addOrUpdatePostOffice,
        deletePostOffice,
        getPostOfficeById,
        addOrUpdateBullion,
        deleteBullion,
        getBullionById,
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
