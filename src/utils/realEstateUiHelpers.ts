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

export interface AreaUnitOption {
  id: string;
  label: string;
  shortLabel: string;
}

export const AREA_UNITS: AreaUnitOption[] = [
  { id: 'sq.ft', label: 'sq.ft (Square Feet)', shortLabel: 'sq.ft' },
  { id: 'acre', label: 'acre (Acres)', shortLabel: 'acre' },
  { id: 'sq.yard', label: 'sq.yard (Sq. Yards / Gaj)', shortLabel: 'sq.yard' },
  { id: 'sq.m', label: 'sq.m (Square Meters)', shortLabel: 'sq.m' },
  { id: 'guntha', label: 'guntha (Guntha)', shortLabel: 'guntha' },
  { id: 'bigha', label: 'bigha (Bigha)', shortLabel: 'bigha' },
  { id: 'hectare', label: 'hectare (Hectares)', shortLabel: 'hectare' },
  { id: 'cent', label: 'cent (Cent)', shortLabel: 'cent' }
];

export function formatPropertyArea(area?: number | string, unit?: string): string {
  if (area === undefined || area === null || area === '') return '';
  const str = String(area).trim();
  if (!str) return '';
  const u = unit && unit.trim() ? unit.trim() : 'sq.ft';
  return `${str} ${u}`;
}

export function parseAreaAndUnit(rawArea?: string | number, rawUnit?: string): { value: string; unit: string } {
  if (rawArea === undefined || rawArea === null || rawArea === '') {
    return { value: '', unit: rawUnit || 'sq.ft' };
  }
  const str = String(rawArea).trim();
  if (rawUnit && rawUnit.trim()) {
    return { value: str.replace(/[^\d.]/g, '') || str, unit: rawUnit.trim() };
  }
  const match = str.match(/^([\d.]+)\s*(sq\.ft|sqft|acre|acres|sq\.yard|sqyard|gaj|sq\.m|sqm|guntha|bigha|hectare|cent)?$/i);
  if (match) {
    const val = match[1];
    const u = match[2]?.toLowerCase();
    let norm = 'sq.ft';
    if (u?.includes('acre')) norm = 'acre';
    else if (u?.includes('yard') || u?.includes('gaj')) norm = 'sq.yard';
    else if (u?.includes('m')) norm = 'sq.m';
    else if (u?.includes('guntha')) norm = 'guntha';
    else if (u?.includes('bigha')) norm = 'bigha';
    else if (u?.includes('hectare')) norm = 'hectare';
    else if (u?.includes('cent')) norm = 'cent';
    return { value: val, unit: norm };
  }
  return { value: str, unit: 'sq.ft' };
}

export function convertAreaToSqft(value: number, unit: string): number {
  if (!value || isNaN(value)) return 0;
  const u = (unit || '').toLowerCase().trim();
  if (u.includes('acre')) return Math.round(value * 43560);
  if (u.includes('yard') || u.includes('gaj')) return Math.round(value * 9);
  if (u.includes('sq.m') || u.includes('sqm') || u === 'm') return Math.round(value * 10.7639);
  if (u.includes('guntha')) return Math.round(value * 1089);
  if (u.includes('bigha')) return Math.round(value * 27225);
  if (u.includes('hectare')) return Math.round(value * 107639);
  if (u.includes('cent')) return Math.round(value * 435.6);
  return Math.round(value);
}
