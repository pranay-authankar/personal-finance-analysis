import type { DeadlineClassification, PropertyType } from '../types';

/**
 * Real Estate Deadline Colour Map Principle:
 * Closest deadline -> Darker shade
 * Farther deadline -> Lighter shade
 * Overdue -> Clearly highlighted warning state
 *
 * Applicable for:
 * 1. Property Purchase Payments (balance payments to be given to seller)
 * 2. Property Sale Receivables (payments to be received from buyers)
 */
export function getDeadlineClassification(deadlineDateStr?: string): DeadlineClassification | null {
  if (!deadlineDateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(deadlineDateStr);
  if (isNaN(deadline.getTime())) return null;
  deadline.setHours(0, 0, 0, 0);

  const diffMs = deadline.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return {
      level: 0,
      label: 'Overdue',
      daysLeft,
      relativeText: overdueDays === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueDays} days`,
      isOverdue: true,
      hexColor: '#DC2626',
      bgTint: '#FEF2F2',
      borderTint: '#F87171',
      textDark: '#991B1B'
    };
  }

  if (daysLeft === 0) {
    return {
      level: 1,
      label: 'Due Today',
      daysLeft: 0,
      relativeText: 'Due today',
      isOverdue: false,
      hexColor: '#9A3412',
      bgTint: '#FFEDD5',
      borderTint: '#EA580C',
      textDark: '#7C2D12'
    };
  }

  if (daysLeft <= 15) {
    return {
      level: 1,
      label: '< 15 Days (Urgent)',
      daysLeft,
      relativeText: `Due in ${daysLeft} days`,
      isOverdue: false,
      hexColor: '#9A3412', // Darkest shade
      bgTint: '#FFEDD5',
      borderTint: '#EA580C',
      textDark: '#7C2D12'
    };
  }

  if (daysLeft <= 45) {
    const weeks = Math.ceil(daysLeft / 7);
    return {
      level: 2,
      label: '15 – 45 Days',
      daysLeft,
      relativeText: `Due in ~${weeks} weeks (${daysLeft}d)`,
      isOverdue: false,
      hexColor: '#C2410C', // Dark-medium shade
      bgTint: '#FFF7ED',
      borderTint: '#FB923C',
      textDark: '#9A3412'
    };
  }

  if (daysLeft <= 90) {
    const months = Math.ceil(daysLeft / 30);
    return {
      level: 3,
      label: '1.5 – 3 Months',
      daysLeft,
      relativeText: `Due in ~${months} mos (${daysLeft}d)`,
      isOverdue: false,
      hexColor: '#D97706', // Medium-light shade
      bgTint: '#FEF3C7',
      borderTint: '#FCD34D',
      textDark: '#B45309'
    };
  }

  // Farther deadline (> 90 days)
  const months = Math.ceil(daysLeft / 30);
  return {
    level: 4,
    label: '> 3 Months',
    daysLeft,
    relativeText: `Due in ~${months} mos`,
    isOverdue: false,
    hexColor: '#0284C7', // Lighter soft tone
    bgTint: '#F0F9FF',
    borderTint: '#BAE6FD',
    textDark: '#0369A1'
  };
}

export const PROPERTY_TYPE_CONFIG: Record<PropertyType | string, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  LAND: {
    label: 'Land',
    icon: '🗺️',
    color: '#15803D',
    bgColor: '#DCFCE7',
    borderColor: '#86EFAC',
    description: 'Plots, agricultural land, residential sites'
  },
  COMMERCIAL_PROPERTY: {
    label: 'Commercial Property',
    icon: '🏢',
    color: '#7C3AED',
    bgColor: '#F3E8FF',
    borderColor: '#D8B4FE',
    description: 'Retail shops, office spaces, warehouses, showrooms'
  },
  PRIVATE_PROPERTIES: {
    label: 'Private Properties',
    icon: '🏡',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    description: 'Villas, independent houses, apartments, residential flats'
  },
  PRIVATE_HOUSE: {
    label: 'Private Properties',
    icon: '🏡',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    description: 'Villas, independent houses, apartments, residential flats'
  },
  'Land': {
    label: 'Land',
    icon: '🗺️',
    color: '#15803D',
    bgColor: '#DCFCE7',
    borderColor: '#86EFAC',
    description: 'Plots, agricultural land, residential sites'
  },
  'Commercial Property': {
    label: 'Commercial Property',
    icon: '🏢',
    color: '#7C3AED',
    bgColor: '#F3E8FF',
    borderColor: '#D8B4FE',
    description: 'Retail shops, office spaces, warehouses, showrooms'
  },
  'Private Properties': {
    label: 'Private Properties',
    icon: '🏡',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    description: 'Villas, independent houses, apartments, residential flats'
  },
  'Private House': {
    label: 'Private Properties',
    icon: '🏡',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    description: 'Villas, independent houses, apartments, residential flats'
  }
};

export const RENTED_CATEGORY_CONFIG = {
  label: 'Rented Property',
  icon: '🔑',
  color: '#D97706',
  bgColor: '#FEF3C7',
  borderColor: '#FDE68A',
  description: 'Income generating properties with active tenants'
};

export const SOLD_CATEGORY_CONFIG = {
  label: 'Sold Properties',
  icon: '🏷️',
  color: '#475569',
  bgColor: '#F1F5F9',
  borderColor: '#CBD5E1',
  description: 'Historical properties with realized sale proceeds'
};

/**
 * Calculates deadline date based on a start date and tenure in months and days.
 */
export function calculateDeadlineDate(startDateStr: string, months: number, days: number): string {
  const base = new Date(startDateStr || new Date().toISOString().split('T')[0]);
  if (isNaN(base.getTime())) return '';
  const result = new Date(base.getTime());
  if (months > 0) {
    result.setMonth(result.getMonth() + Number(months));
  }
  if (days > 0) {
    result.setDate(result.getDate() + Number(days));
  }
  return result.toISOString().split('T')[0];
}

/**
 * Formats tenure in months and days between two dates.
 */
export function calculateTenureFromDates(startDateStr: string, deadlineDateStr: string): { months: number; days: number; text: string } {
  if (!startDateStr || !deadlineDateStr) return { months: 0, days: 0, text: '' };
  const start = new Date(startDateStr);
  const end = new Date(deadlineDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { months: 0, days: 0, text: '' };

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return { months: 0, days: 0, text: 'Immediate / 0 days' };

  const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;

  let text = '';
  if (months > 0 && days > 0) {
    text = `${months} ${months === 1 ? 'Month' : 'Months'}, ${days} ${days === 1 ? 'Day' : 'Days'}`;
  } else if (months > 0) {
    text = `${months} ${months === 1 ? 'Month' : 'Months'}`;
  } else {
    text = `${days} ${days === 1 ? 'Day' : 'Days'}`;
  }

  return { months, days, text };
}

