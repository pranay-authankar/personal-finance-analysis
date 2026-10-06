import type { FixedDeposit } from '../types';

/**
 * Masks bank account number to show only the last 4 digits for privacy.
 * Example: "1234567890" -> "•••• 7890"
 */
export function maskAccountNumber(acc?: string): string {
  if (!acc || acc.trim() === '' || acc.trim() === '-') return '•••• —';
  const clean = acc.trim();
  if (clean.startsWith('••') || clean.startsWith('**')) return clean;
  if (clean.length <= 4) return `•••• ${clean}`;
  return `•••• ${clean.slice(-4)}`;
}

export type FdMaturityStatus = 'safe' | 'approaching' | 'due' | 'overdue' | 'redeemed';

export interface FdStatusIndicator {
  type: FdMaturityStatus;
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  daysLeft?: number;
}

/**
 * Returns consistent status indicator colours:
 * - Safe: Green / Emerald (> 6 months)
 * - Approaching: Warm Amber (1 - 6 months)
 * - Due: Crimson (within 30 days)
 * - Overdue: Crimson (< 0 days)
 * - Redeemed: Slate (if actualEndDate exists or status is redeemed)
 */
export function getFdStatus(
  maturityDateStr: string,
  actualEndDate?: string,
  status?: string
): FdStatusIndicator {
  if (status === 'redeemed' || (actualEndDate && actualEndDate.trim() !== '')) {
    return {
      type: 'redeemed',
      label: 'Redeemed',
      dotColor: '#64748B',
      bgColor: '#F1F5F9',
      textColor: '#475569',
      borderColor: '#E2E8F0'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matDate = new Date(maturityDateStr);
  matDate.setHours(0, 0, 0, 0);

  const diffMs = matDate.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      type: 'overdue',
      label: 'Overdue',
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
      label: daysLeft === 0 ? 'Due Today' : `Due (${daysLeft}d)`,
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
 * Finds the earliest upcoming maturity from a list of active FDs.
 */
export function getNextMaturityInfo(fds: FixedDeposit[]): {
  dateStr: string | null;
  daysLeft: number | null;
  status: FdStatusIndicator | null;
} {
  const activeFds = fds.filter((f) => !f.actualEndDate && f.status !== 'redeemed' && f.maturityDate);
  if (activeFds.length === 0) {
    return { dateStr: null, daysLeft: null, status: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort by maturity date ascending
  const sorted = [...activeFds].sort(
    (a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime()
  );

  const next = sorted[0];
  const nextDate = new Date(next.maturityDate);
  nextDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    dateStr: next.maturityDate,
    daysLeft: diffDays,
    status: getFdStatus(next.maturityDate, next.actualEndDate, next.status)
  };
}
