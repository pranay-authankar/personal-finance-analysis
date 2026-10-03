import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FamilyMember, FixedDeposit, PortfolioSummary } from '../types';
import { DEFAULT_SEED_MEMBERS } from '../data/seedData';

const STORAGE_KEYS = {
  MEMBERS: 'familyvault_members_data',
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
  addOrUpdateFd: (fd: Partial<FixedDeposit>) => FixedDeposit;
  deleteFd: (id: string) => void;
  getPortfolioSummary: (member?: FamilyMember) => PortfolioSummary;
  getFdById: (id: string) => FixedDeposit | undefined;
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
      fds: []
    };

    setMembers((prev) => [...prev, newMember]);
    setActiveMemberIdState(newMember.id);
    return newMember;
  };

  const addOrUpdateFd = (fdData: Partial<FixedDeposit>): FixedDeposit => {
    let savedFd: FixedDeposit;

    setMembers((prevMembers) => {
      return prevMembers.map((member) => {
        if (member.id !== activeMemberId) return member;

        const fds = [...(member.fds || [])];
        if (fdData.id) {
          // Update
          const index = fds.findIndex((f) => f.id === fdData.id);
          if (index !== -1) {
            savedFd = { ...fds[index], ...fdData } as FixedDeposit;
            fds[index] = savedFd;
          } else {
            savedFd = fdData as FixedDeposit;
            fds.push(savedFd);
          }
        } else {
          // Add new
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
    return activeMember.fds.find((f) => f.id === id);
  };

  const getPortfolioSummary = (memberTarget?: FamilyMember): PortfolioSummary => {
    const target = memberTarget || activeMember;
    if (!target) {
      return {
        total: 0,
        fdTotal: 0,
        breakdown: { fds: 0, postOffice: 0, stocksMf: 0, realEstate: 0, bullions: 0, cashInHand: 0 }
      };
    }

    const fds = target.fds || [];
    const fdTotal = fds.reduce((sum, f) => sum + (Number(f.principal) || 0), 0);
    const o = target.otherAssets || { postOffice: 0, stocksMf: 0, realEstate: 0, bullions: 0, cashInHand: 0 };

    const total = fdTotal + (o.postOffice || 0) + (o.stocksMf || 0) + (o.realEstate || 0) + (o.bullions || 0) + (o.cashInHand || 0);

    return {
      total,
      fdTotal,
      breakdown: {
        fds: fdTotal,
        postOffice: o.postOffice || 0,
        stocksMf: o.stocksMf || 0,
        realEstate: o.realEstate || 0,
        bullions: o.bullions || 0,
        cashInHand: o.cashInHand || 0
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
        getPortfolioSummary,
        getFdById
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
