export interface RealizedTransaction {
  id: string; // payment_id
  a_id: string; // asset ID
  assetName: string;
  assetType: 'REAL_ESTATE' | 'FD' | 'POST_OFFICE' | 'BULLION' | 'OTHER';
  source: 'Sale' | 'Maturity';
  paymentContext: 'SALE' | 'MATURITY';
  amount: number;
  paymentDate: string;
  status: string;
  notes: string;
  memberId: string;
  memberName: string;
}

export type RealizedFundsSourceTab = 'All' | 'Asset Sales' | 'Maturities';

export interface RealizedFundsFilterState {
  source: 'all' | 'SALE' | 'MATURITY';
  memberId: 'all' | string;
  amountRange: 'all' | 'under_1l' | '1l_10l' | '10l_50l' | 'above_50l';
  dateRange: 'all' | 'last_30_days' | 'last_90_days' | 'this_year' | 'older';
}

export interface AssetTypeMeta {
  type: 'REAL_ESTATE' | 'FD' | 'POST_OFFICE' | 'BULLION' | 'OTHER';
  label: string;
  icon: string;
  bgTint: string;
  borderTint: string;
  textColor: string;
}

export function getAssetTypeMeta(assetType?: string): AssetTypeMeta {
  switch (assetType) {
    case 'REAL_ESTATE':
      return {
        type: 'REAL_ESTATE',
        label: 'Real Estate',
        icon: '🏢',
        bgTint: '#F8FAFC',
        borderTint: '#CBD5E1',
        textColor: '#334155'
      };
    case 'FD':
      return {
        type: 'FD',
        label: 'Fixed Deposit',
        icon: '🏦',
        bgTint: '#EFF6FF',
        borderTint: '#BFDBFE',
        textColor: '#1E40AF'
      };
    case 'POST_OFFICE':
      return {
        type: 'POST_OFFICE',
        label: 'Post Office',
        icon: '📮',
        bgTint: '#FFF7ED',
        borderTint: '#FED7AA',
        textColor: '#C2410C'
      };
    case 'BULLION':
      return {
        type: 'BULLION',
        label: 'Bullions',
        icon: '🪙',
        bgTint: '#FEFCE8',
        borderTint: '#FEF08A',
        textColor: '#854D0E'
      };
    default:
      return {
        type: 'OTHER',
        label: 'Asset',
        icon: '💼',
        bgTint: '#F1F5F9',
        borderTint: '#E2E8F0',
        textColor: '#475569'
      };
  }
}

export function getSourceBadgeMeta(source: 'Sale' | 'Maturity' | string) {
  if (source === 'Sale' || source === 'SALE') {
    return {
      label: 'Asset Sale',
      icon: '🏷️',
      bg: '#FFFBEB',
      border: '#FDE68A',
      color: '#B45309'
    };
  }
  return {
    label: 'Maturity',
    icon: '⏱️',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    color: '#047857'
  };
}

export function matchesAmountRange(amount: number, range: RealizedFundsFilterState['amountRange']): boolean {
  if (range === 'all') return true;
  if (range === 'under_1l') return amount > 0 && amount < 100000;
  if (range === '1l_10l') return amount >= 100000 && amount <= 1000000;
  if (range === '10l_50l') return amount > 1000000 && amount <= 5000000;
  if (range === 'above_50l') return amount > 5000000;
  return true;
}

export function matchesDateRange(dateStr: string, range: RealizedFundsFilterState['dateRange']): boolean {
  if (range === 'all' || !dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (range === 'last_30_days') {
    return diffDays >= 0 && diffDays <= 30;
  }
  if (range === 'last_90_days') {
    return diffDays >= 0 && diffDays <= 90;
  }
  if (range === 'this_year') {
    return d.getFullYear() === now.getFullYear();
  }
  if (range === 'older') {
    return d.getFullYear() < now.getFullYear();
  }
  return true;
}
