import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FamilyMember, FixedDeposit, PostOfficeInvestment, BullionInvestment, PortfolioSummary } from '../types';
import { DEFAULT_SEED_MEMBERS } from '../data/seedData';
import { getEffectiveBullionValue } from '../utils/bullionCalculations';

const STORAGE_KEYS = {
  MEMBERS: 'familyvault_members_data_v3', // v3 to include bullions structures
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

  // Portfolio Summary Calculation
  const getPortfolioSummary = (memberTarget?: FamilyMember): PortfolioSummary => {
    const target = memberTarget || activeMember;
    if (!target) {
      return {
        total: 0,
        fdTotal: 0,
        postOfficeTotal: 0,
        bullionsTotal: 0,
        breakdown: { fds: 0, postOffice: 0, stocksMf: 0, realEstate: 0, bullions: 0, cashInHand: 0 }
      };
    }

    const fds = target.fds || [];
    const fdTotal = fds.reduce((sum, f) => sum + (Number(f.principal) || 0), 0);

    const poList = target.postOfficeInvestments || [];
    const poCalculatedTotal = poList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const postOfficeTotal = poCalculatedTotal > 0 ? poCalculatedTotal : (target.otherAssets?.postOffice || 0);

    const bulList = target.bullionsInvestments || [];
    // Only entries with sufficient value contribute to the total!
    const bulCalculatedTotal = bulList.reduce((sum, b) => {
      return sum + getEffectiveBullionValue(b);
    }, 0);
    const bullionsTotal = bulList.length > 0 ? bulCalculatedTotal : (target.otherAssets?.bullions || 0);

    const o = target.otherAssets || { stocksMf: 0, realEstate: 0, cashInHand: 0 };
    const stocksMf = o.stocksMf || 0;
    const realEstate = o.realEstate || 0;
    const cashInHand = o.cashInHand || 0;

    const total = fdTotal + postOfficeTotal + bullionsTotal + stocksMf + realEstate + cashInHand;

    return {
      total,
      fdTotal,
      postOfficeTotal,
      bullionsTotal,
      breakdown: {
        fds: fdTotal,
        postOffice: postOfficeTotal,
        stocksMf,
        realEstate,
        bullions: bullionsTotal,
        cashInHand
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
