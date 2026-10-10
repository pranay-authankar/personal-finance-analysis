import type { BullionInvestment, BullionType } from '../types';

export interface BullionTypeMetadata {
  type: BullionType;
  name: string;
  icon: string;
  color: string;
  badgeBg: string;
  description: string;
}

export const BULLION_METADATA: Record<string, BullionTypeMetadata> = {
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
  DIAMOND: {
    type: 'DIAMOND',
    name: 'Diamond & Precious Stones',
    icon: '💎',
    color: '#0EA5E9',
    badgeBg: '#E0F2FE',
    description: 'Certified diamonds, solitaires, and precious gemstones'
  },
  OTHER: {
    type: 'OTHER',
    name: 'Other Bullion Asset',
    icon: '💎',
    color: '#7C3AED',
    badgeBg: '#F3E8FF',
    description: 'Custom bullion, palladium, rhodium, sovereign tokens'
  }
};

/**
 * Returns metadata (icon, color, badgeBg) for any user-typed bullion string.
 */
export function getBullionMetadata(rawType?: string): BullionTypeMetadata {
  if (!rawType) return BULLION_METADATA.OTHER;
  const upper = rawType.trim().toUpperCase();
  if (BULLION_METADATA[upper]) return BULLION_METADATA[upper];

  const lower = rawType.toLowerCase();
  if (lower.includes('gold')) {
    return {
      type: rawType,
      name: rawType,
      icon: '🪙',
      color: '#D97706',
      badgeBg: '#FEF3C7',
      description: 'Gold holding'
    };
  }
  if (lower.includes('silver')) {
    return {
      type: rawType,
      name: rawType,
      icon: '🥈',
      color: '#475569',
      badgeBg: '#F1F5F9',
      description: 'Silver holding'
    };
  }
  if (lower.includes('platinum')) {
    return {
      type: rawType,
      name: rawType,
      icon: '💍',
      color: '#0284C7',
      badgeBg: '#E0F2FE',
      description: 'Platinum holding'
    };
  }
  if (lower.includes('diamond') || lower.includes('gem') || lower.includes('jewel')) {
    return {
      type: rawType,
      name: rawType,
      icon: '💎',
      color: '#0EA5E9',
      badgeBg: '#E0F2FE',
      description: 'Precious stone'
    };
  }
  if (lower.includes('copper') || lower.includes('bronze')) {
    return {
      type: rawType,
      name: rawType,
      icon: '🪙',
      color: '#B45309',
      badgeBg: '#FFEDD5',
      description: 'Base bullion metal'
    };
  }

  return {
    type: rawType,
    name: rawType,
    icon: '🪙',
    color: '#7C3AED',
    badgeBg: '#F3E8FF',
    description: 'Bullion asset'
  };
}

export interface WeightUnitOption {
  id: string;
  label: string;
  shortLabel: string;
  toGramsFactor: number;
}

export const WEIGHT_UNIT_OPTIONS: WeightUnitOption[] = [
  { id: 'g', label: 'Grams (g)', shortLabel: 'g', toGramsFactor: 1 },
  { id: 'mg', label: 'Milligrams (mg)', shortLabel: 'mg', toGramsFactor: 0.001 },
  { id: 'kg', label: 'Kilograms (kg)', shortLabel: 'kg', toGramsFactor: 1000 },
  { id: 'pound', label: 'Pound (lbs)', shortLabel: 'lbs', toGramsFactor: 453.59237 },
  { id: 'tola', label: 'Tola (tola)', shortLabel: 'tola', toGramsFactor: 11.6638 },
  { id: 'oz', label: 'Troy Ounce (oz)', shortLabel: 'oz', toGramsFactor: 31.1034768 }
];

export function convertToGrams(amount: number, unit?: string): number {
  if (!unit) return amount;
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'pound' || normalized === 'pounds' || normalized === 'lbs' || normalized === 'lb') {
    return amount * 453.59237;
  }
  const match = WEIGHT_UNIT_OPTIONS.find(
    (u) => u.id.toLowerCase() === normalized || u.shortLabel.toLowerCase() === normalized
  );
  if (match) {
    return amount * match.toGramsFactor;
  }
  return amount;
}

/**
 * Checks whether an entry has sufficient value information to contribute
 * to the Total Bullions Investment Value and pie chart.
 */
export function hasSufficientValue(b: BullionInvestment): boolean {
  if (b.investedValue !== undefined && Number(b.investedValue) > 0) {
    return true;
  }
  if (
    b.weight !== undefined &&
    b.purchaseRate !== undefined &&
    Number(b.weight) > 0 &&
    Number(b.purchaseRate) > 0
  ) {
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
    b.weight !== undefined &&
    b.purchaseRate !== undefined &&
    Number(b.weight) > 0 &&
    Number(b.purchaseRate) > 0
  ) {
    return Math.round(Number(b.weight) * Number(b.purchaseRate));
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

