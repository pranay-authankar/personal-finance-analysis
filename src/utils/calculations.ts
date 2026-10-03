import type { FDCalculation } from '../types';

/**
 * Standard Indian Banking Interest Calculation
 * - Tenure < 180 days: Simple Interest
 * - Tenure >= 180 days: Quarterly Compounding (A = P * (1 + r/4)^(4*t))
 */
export function calculateFDValues(
  principal: number,
  annualRatePct: number,
  startDateStr: string,
  maturityDateStr: string
): FDCalculation {
  const P = Number(principal) || 0;
  const r = (Number(annualRatePct) || 0) / 100;

  if (!startDateStr || !maturityDateStr) {
    return {
      principal: P,
      maturityAmount: P,
      interestEarned: 0,
      tenureDays: 0,
      tenureFormatted: '-'
    };
  }

  const start = new Date(startDateStr);
  const maturity = new Date(maturityDateStr);

  const diffMs = maturity.getTime() - start.getTime();
  const tenureDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  const tenureYears = tenureDays / 365.25;

  let maturityAmount = P;
  let interestEarned = 0;

  if (tenureYears > 0 && r > 0 && P > 0) {
    if (tenureDays < 180) {
      interestEarned = P * r * (tenureDays / 365);
      maturityAmount = P + interestEarned;
    } else {
      const n = 4; // Quarterly compounding
      maturityAmount = P * Math.pow(1 + r / n, n * tenureYears);
      interestEarned = maturityAmount - P;
    }
  }

  return {
    principal: Math.round(P),
    maturityAmount: Math.round(maturityAmount),
    interestEarned: Math.round(interestEarned),
    tenureDays,
    tenureFormatted: formatTenure(tenureDays)
  };
}

export function formatTenure(days: number): string {
  if (days <= 0) return '0 days';
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  const months = Math.floor(remainingDays / 30);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
  if (parts.length === 0) parts.push(`${days} Days`);

  return parts.join(' ');
}

export function formatCurrency(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '0';
  return Number(num).toLocaleString('en-IN');
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
