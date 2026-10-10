import type { PropertyRecord, PropertyType } from '../types';

export type RealEstateCategoryTab = 'All' | 'Land' | 'Commercial' | 'Private House';

export interface RealEstateCategoryTheme {
  category: 'Land' | 'Commercial' | 'Private House';
  label: string;
  icon: string;
  borderAccent: string;
  bgTint: string;
  borderTint: string;
  textColor: string;
}

export interface RealEstateFilterState {
  status: 'all' | 'active' | 'sold';
  location: string;
  priceRange: 'all' | 'under_25l' | '25l_50l' | '50l_1cr' | 'above_1cr';
}

/**
 * Resolves a property into one of the 3 requested categories:
 * Land | Commercial | Private House
 */
export function getRealEstateCategory(p: PropertyRecord): 'Land' | 'Commercial' | 'Private House' {
  const t = (p.p_type || '').toUpperCase();
  if (t === 'LAND' || t.includes('LAND')) {
    return 'Land';
  }
  if (t.includes('COMMERCIAL')) {
    return 'Commercial';
  }
  return 'Private House';
}

/**
 * Normalizes property type string for display and form inputs
 */
export function normalizePropertyType(t: PropertyType | string): PropertyType {
  const upper = (t || '').toUpperCase();
  if (upper.includes('LAND')) return 'LAND';
  if (upper.includes('COMMERCIAL')) return 'COMMERCIAL_PROPERTY';
  return 'PRIVATE_HOUSE';
}

/**
 * Returns restrained, consistent visual theme tokens for property categories.
 */
export function getRealEstateCategoryTheme(category: 'Land' | 'Commercial' | 'Private House'): RealEstateCategoryTheme {
  switch (category) {
    case 'Land':
      return {
        category: 'Land',
        label: 'Land Plot',
        icon: '🌱',
        borderAccent: '#059669', // Restrained emerald/sage green
        bgTint: '#ECFDF5',
        borderTint: '#A7F3D0',
        textColor: '#065F46'
      };
    case 'Commercial':
      return {
        category: 'Commercial',
        label: 'Commercial',
        icon: '🏢',
        borderAccent: '#0F1E36', // Deep navy
        bgTint: '#EEF3F8',
        borderTint: '#C8D6E5',
        textColor: '#0F1E36'
      };
    case 'Private House':
    default:
      return {
        category: 'Private House',
        label: 'Private House',
        icon: '🏡',
        borderAccent: '#B58924', // Muted gold accent
        bgTint: '#FDF9EE',
        borderTint: '#EEDEB6',
        textColor: '#8C6412'
      };
  }
}

/**
 * Checks whether key property information is incomplete (missing price, location, or date).
 */
export function isPropertyIncomplete(p: PropertyRecord): boolean {
  const hasPrice = Number(p.purchase_price) > 0;
  const hasLocation = Boolean(p.location && p.location.trim() !== '');
  const hasDate = Boolean(p.purchase_date && p.purchase_date.trim() !== '');

  return !hasPrice || !hasLocation || !hasDate;
}
