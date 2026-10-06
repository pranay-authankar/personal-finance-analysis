import type { PostOfficeInvestment } from '../types';

/**
 * Masks account number to show only the last 4 digits for privacy.
 * Example: "1234567890" -> "•••• 7890"
 */
export function maskAccountNumber(acc?: string): string {
  if (!acc || acc.trim() === '' || acc.trim() === '-') return '•••• —';
  const clean = acc.trim();
  if (clean.startsWith('••') || clean.startsWith('**')) return clean;
  if (clean.length <= 4) return `•••• ${clean}`;
  return `•••• ${clean.slice(-4)}`;
}

export type PostOfficeStatusType = 'safe' | 'approaching' | 'due' | 'overdue' | 'redeemed' | 'missed' | 'pending';

export interface PostOfficeStatusIndicator {
  type: PostOfficeStatusType;
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  daysLeft?: number;
}

/**
 * Returns consistent status indicator colours:
 * - Safe: Green / Emerald (> 6 months to maturity or all RD installments paid)
 * - Approaching: Warm Amber (1 - 6 months or due within 45 days)
 * - Due / Overdue: Brick Crimson (due within 30 days or overdue)
 * - Redeemed: Slate (if actualEndDate exists or status is redeemed/closed)
 * - RD specific: Missed (Crimson), Pending (Amber), Paid (Green)
 */
export function getPostOfficeStatus(
  inv: PostOfficeInvestment
): PostOfficeStatusIndicator {
  if (inv.status === 'redeemed' || inv.status === 'closed' || (inv.actualEndDate && inv.actualEndDate.trim() !== '')) {
    return {
      type: 'redeemed',
      label: 'Closed',
      dotColor: '#64748B',
      bgColor: '#F1F5F9',
      textColor: '#475569',
      borderColor: '#E2E8F0'
    };
  }

  // RD specific installment condition check
  if (inv.schemeType === 'RD') {
    if (inv.missedDepositsCount && inv.missedDepositsCount > 0) {
      return {
        type: 'missed',
        label: `${inv.missedDepositsCount} Missed`,
        dotColor: '#DC2626',
        bgColor: '#FEF2F2',
        textColor: '#991B1B',
        borderColor: '#FCA5A5'
      };
    }

    if (inv.nextDepositDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const depDate = new Date(inv.nextDepositDate);
      depDate.setHours(0, 0, 0, 0);
      const diffMs = depDate.getTime() - today.getTime();
      const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        return {
          type: 'overdue',
          label: 'Deposit Overdue',
          daysLeft,
          dotColor: '#DC2626',
          bgColor: '#FEF2F2',
          textColor: '#991B1B',
          borderColor: '#FCA5A5'
        };
      }
      if (daysLeft <= 15) {
        return {
          type: 'due',
          label: daysLeft === 0 ? 'Due Today' : `Due (${daysLeft}d)`,
          daysLeft,
          dotColor: '#DC2626',
          bgColor: '#FEF2F2',
          textColor: '#991B1B',
          borderColor: '#FCA5A5'
        };
      }
      if (daysLeft <= 45) {
        return {
          type: 'pending',
          label: 'Pending',
          daysLeft,
          dotColor: '#D97706',
          bgColor: '#FFFBEB',
          textColor: '#92400E',
          borderColor: '#FDE68A'
        };
      }
    }
  }

  // General Maturity-based status (TD, MIS, SCSS, or fallback for RD)
  if (!inv.maturityDate) {
    return {
      type: 'safe',
      label: 'Active',
      dotColor: '#059669',
      bgColor: '#ECFDF5',
      textColor: '#065F46',
      borderColor: '#A7F3D0'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const matDate = new Date(inv.maturityDate);
  matDate.setHours(0, 0, 0, 0);

  const diffMs = matDate.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      type: 'overdue',
      label: 'Matured',
      daysLeft,
      dotColor: '#DC2626',
      bgColor: '#FEF2F2',
      textColor: '#991B1B',
      borderColor: '#FCA5A5'
    };
  }

  if (daysLeft <= 30) {
    return {
      type: 'due',
      label: daysLeft === 0 ? 'Matures Today' : `Due (${daysLeft}d)`,
      daysLeft,
      dotColor: '#DC2626',
      bgColor: '#FEF2F2',
      textColor: '#991B1B',
      borderColor: '#FCA5A5'
    };
  }

  if (daysLeft <= 180) {
    const months = Math.ceil(daysLeft / 30);
    return {
      type: 'approaching',
      label: `Approaching (${months}m)`,
      daysLeft,
      dotColor: '#D97706',
      bgColor: '#FFFBEB',
      textColor: '#92400E',
      borderColor: '#FDE68A'
    };
  }

  return {
    type: 'safe',
    label: 'Safe',
    daysLeft,
    dotColor: '#059669',
    bgColor: '#ECFDF5',
    textColor: '#065F46',
    borderColor: '#A7F3D0'
  };
}

/**
 * Finds the earliest upcoming due date across active Post Office investments:
 * - RD: next deposit date
 * - MIS / SCSS: next interest payout date
 * - TD: maturity date
 */
export function getNextPostOfficeDueInfo(investments: PostOfficeInvestment[]): {
  title: string;
  dateStr: string | null;
  daysLeft: number | null;
  status: PostOfficeStatusIndicator | null;
} {
  const active = investments.filter((i) => !i.actualEndDate && i.status !== 'closed' && i.status !== 'redeemed');
  if (active.length === 0) {
    return { title: 'None', dateStr: null, daysLeft: null, status: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidates: Array<{
    title: string;
    dateStr: string;
    inv: PostOfficeInvestment;
  }> = [];

  active.forEach((i) => {
    if (i.schemeType === 'RD' && i.nextDepositDate) {
      candidates.push({
        title: 'RD Deposit',
        dateStr: i.nextDepositDate,
        inv: i
      });
    } else if ((i.schemeType === 'MIS' || i.schemeType === 'SCSS') && i.nextInterestDate) {
      candidates.push({
        title: `${i.schemeType} Payout`,
        dateStr: i.nextInterestDate,
        inv: i
      });
    } else if (i.maturityDate) {
      candidates.push({
        title: `${i.schemeType} Maturity`,
        dateStr: i.maturityDate,
        inv: i
      });
    }
  });

  if (candidates.length === 0) {
    return { title: 'None', dateStr: null, daysLeft: null, status: null };
  }

  candidates.sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

  const earliest = candidates[0];
  const targetDate = new Date(earliest.dateStr);
  targetDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    title: earliest.title,
    dateStr: earliest.dateStr,
    daysLeft: diffDays,
    status: getPostOfficeStatus(earliest.inv)
  };
}
