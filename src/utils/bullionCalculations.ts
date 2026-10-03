import type { BullionInvestment, BullionType } from '../types';

export interface BullionTypeMetadata {
  type: BullionType;
  name: string;
  icon: string;
  color: string;
  badgeBg: string;
  description: string;
}

export const BULLION_METADATA: Record<BullionType, BullionTypeMetadata> = {
  GOLD: {
    type: 'GOLD',
    name: 'Gold (Au)',
    icon: '🪙',
    color: '#D97706',
    badgeBg: '#FEF3C7',
    description: 'Physical 24K/22K bars, sovereign coins, digital gold, ornaments'
  },
  SILVER: {
    type: 'SILVER',
    name: 'Silver (Ag)',
    icon: '🥈',
    color: '#475569',
    badgeBg: '#F1F5F9',
    description: '999 fine silver ingots, bars, coins, and silverware'
  },
  PLATINUM: {
    type: 'PLATINUM',
    name: 'Platinum (Pt)',
    icon: '💍',
    color: '#0284C7',
    badgeBg: '#E0F2FE',
    description: 'Investment grade 950 pure platinum bars and jewellery'
  },
  OTHER: {
    type: 'OTHER',
    name: 'Other Precious Assets',
    icon: '💎',
    color: '#7C3AED',
    badgeBg: '#F3E8FF',
    description: 'Palladium, rhodium, certified gemstones, sovereign tokens'
  }
};

/**
 * Checks whether an entry has sufficient value information to contribute
 * to the Total Bullions Investment Value and pie chart.
 */
export function hasSufficientValue(b: BullionInvestment): boolean {
  if (b.investedValue !== undefined && Number(b.investedValue) > 0) {
    return true;
  }
  if (
    b.weightGrams !== undefined &&
    b.purchaseRate !== undefined &&
    Number(b.weightGrams) > 0 &&
    Number(b.purchaseRate) > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Calculates effective recorded/invested value of a bullion record.
 * Returns 0 if sufficient value information is missing.
 */
export function getEffectiveBullionValue(b: BullionInvestment): number {
  if (b.investedValue !== undefined && Number(b.investedValue) > 0) {
    return Math.round(Number(b.investedValue));
  }
  if (
    b.weightGrams !== undefined &&
    b.purchaseRate !== undefined &&
    Number(b.weightGrams) > 0 &&
    Number(b.purchaseRate) > 0
  ) {
    return Math.round(Number(b.weightGrams) * Number(b.purchaseRate));
  }
  return 0;
}
