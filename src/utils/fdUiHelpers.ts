import type { FixedDeposit } from '../types';
import { getDaysDiff, parseLocalDate } from './dateUtils';

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
  status?: string,
  referenceDate: Date = new Date()
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

  const daysLeft = getDaysDiff(maturityDateStr, referenceDate) ?? 0;

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
export function getNextMaturityInfo(
  fds: FixedDeposit[],
  referenceDate: Date = new Date()
): {
  dateStr: string | null;
  daysLeft: number | null;
  status: FdStatusIndicator | null;
} {
  const activeFds = fds.filter((f) => !f.actualEndDate && f.status !== 'redeemed' && f.maturityDate);
  if (activeFds.length === 0) {
    return { dateStr: null, daysLeft: null, status: null };
  }

  // Sort by maturity date ascending safely
  const sorted = [...activeFds].sort((a, b) => {
    const da = parseLocalDate(a.maturityDate)?.getTime() || 0;
    const db = parseLocalDate(b.maturityDate)?.getTime() || 0;
    return da - db;
  });

  const next = sorted[0];
  const diffDays = getDaysDiff(next.maturityDate, referenceDate);

  return {
    dateStr: next.maturityDate,
    daysLeft: diffDays,
    status: getFdStatus(next.maturityDate, next.actualEndDate, next.status, referenceDate)
  };
}
