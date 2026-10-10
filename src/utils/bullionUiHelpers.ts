import type { BullionInvestment } from '../types';

export type BullionCategoryTab = 'All' | 'Gold' | 'Silver' | 'Diamonds' | 'Stones' | 'Other';

export interface BullionCategoryTheme {
  category: 'Gold' | 'Silver' | 'Diamonds' | 'Stones' | 'Other';
  label: string;
  borderAccent: string;
  bgTint: string;
  borderTint: string;
  textColor: string;
  badgeBg: string;
  icon: string;
}

export interface BullionFilterState {
  status: 'all' | 'held' | 'sold';
  valueRange: 'all' | 'under_50k' | '50k_2l' | '2l_5l' | 'above_5l';
}

/**
 * Resolves a bullion investment into one of the 5 requested categories:
 * Gold | Silver | Diamonds | Stones | Other
 */
export function getBullionCategory(b: BullionInvestment): 'Gold' | 'Silver' | 'Diamonds' | 'Stones' | 'Other' {
  const combined = `${b.typeName || ''} ${b.type || ''} ${b.itemName || ''}`.toLowerCase();

  if (combined.includes('gold')) {
    return 'Gold';
  }
  if (combined.includes('silver')) {
    return 'Silver';
  }
  if (combined.includes('diamond')) {
    return 'Diamonds';
  }
  if (
    combined.includes('stone') ||
    combined.includes('gem') ||
    combined.includes('ruby') ||
    combined.includes('emerald') ||
    combined.includes('sapphire') ||
    combined.includes('pearl') ||
    combined.includes('topaz') ||
    combined.includes('garnet')
  ) {
    return 'Stones';
  }
  return 'Other';
}

/**
 * Provides restrained, classy styling tokens for each asset type.
 * Gold receives subtle muted gold accents; others receive restrained, consistent colors.
 */
export function getBullionCategoryTheme(category: 'Gold' | 'Silver' | 'Diamonds' | 'Stones' | 'Other'): BullionCategoryTheme {
  switch (category) {
    case 'Gold':
      return {
        category: 'Gold',
        label: 'Gold',
        borderAccent: '#B58924', // Muted gold
        bgTint: '#FDF9EE',
        borderTint: '#EEDEB6',
        textColor: '#8C6412',
        badgeBg: '#FEF3C7',
        icon: '🪙'
      };
    case 'Silver':
      return {
        category: 'Silver',
        label: 'Silver',
        borderAccent: '#64748B', // Restrained slate / silver
        bgTint: '#F8FAFC',
        borderTint: '#CBD5E1',
        textColor: '#334155',
        badgeBg: '#F1F5F9',
        icon: '🥈'
      };
    case 'Diamonds':
      return {
        category: 'Diamonds',
        label: 'Diamond',
        borderAccent: '#0284C7', // Refined ice blue
        bgTint: '#F0F9FF',
        borderTint: '#BAE6FD',
        textColor: '#0369A1',
        badgeBg: '#E0F2FE',
        icon: '💎'
      };
    case 'Stones':
      return {
        category: 'Stones',
        label: 'Precious Stone',
        borderAccent: '#059669', // Restrained emerald green
        bgTint: '#ECFDF5',
        borderTint: '#A7F3D0',
        textColor: '#065F46',
        badgeBg: '#D1FAE5',
        icon: '✨'
      };
    case 'Other':
    default:
      return {
        category: 'Other',
        label: 'Precious Asset',
        borderAccent: '#475569', // Charcoal / platinum
        bgTint: '#F1F5F9',
        borderTint: '#E2E8F0',
        textColor: '#1E293B',
        badgeBg: '#E2E8F0',
        icon: '🏷️'
      };
  }
}

/**
 * Returns true if key information (purchase value or purchase date) is missing.
 */
export function isBullionIncomplete(b: BullionInvestment): boolean {
  const hasValue = b.investedValue !== undefined && Number(b.investedValue) > 0;
  const hasRateAndWeight =
    Boolean(b.weight && b.purchaseRate && Number(b.weight) > 0 && Number(b.purchaseRate) > 0) ||
    Boolean(b.weightGrams && b.purchaseRate && Number(b.weightGrams) > 0 && Number(b.purchaseRate) > 0);
  const hasDate = Boolean(b.purchaseDate && b.purchaseDate.trim() !== '');

  return !(hasValue || hasRateAndWeight) || !hasDate;
}
