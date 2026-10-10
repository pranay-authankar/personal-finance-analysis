import type { MaturityClassification } from '../types';
import { getDaysDiff } from './dateUtils';

/**
 * FD Maturity Colour Map Classifier:
 * Level 1: < 3 Months (Immediate / Urgent) -> Darkest Crimson (#991B1B)
 * Level 2: 3 - 6 Months (Near Term)        -> Deep Burnt Orange (#C2410C)
 * Level 3: 6 - 12 Months (Medium Term)     -> Rich Amber (#D97706)
 * Level 4: 1 - 2 Years (Extended Term)     -> Soft Warm Gold (#EAB308)
 * Level 5: > 2 Years (Long Term)           -> Calm Sky Slate (#38BDF8)
 */
export function getMaturityClassification(
  maturityDateStr: string,
  referenceDate: Date = new Date()
): MaturityClassification {
  const daysLeft = getDaysDiff(maturityDateStr, referenceDate) ?? 0;

  if (daysLeft < 0) {
    return {
      level: 1,
      shadeClass: 'shade-urgent',
      pillClass: 'pill-urgent',
      label: 'Matured (Overdue)',
      daysLeft,
      relativeText: `Matured ${Math.abs(daysLeft)}d ago`,
      isUrgent: true,
      hexColor: '#991B1B',
      bgTint: 'rgba(153, 27, 27, 0.07)',
      borderTint: '#991B1B'
    };
  } else if (daysLeft <= 90) {
    return {
      level: 1,
      shadeClass: 'shade-urgent',
      pillClass: 'pill-urgent',
      label: '< 3 Months (Urgent)',
      daysLeft,
      relativeText: daysLeft === 0 ? 'Matures Today' : `Matures in ${daysLeft} days`,
      isUrgent: true,
      hexColor: '#991B1B',
      bgTint: 'rgba(153, 27, 27, 0.07)',
      borderTint: '#991B1B'
    };
  } else if (daysLeft <= 180) {
    const months = Math.ceil(daysLeft / 30);
    return {
      level: 2,
      shadeClass: 'shade-near',
      pillClass: 'pill-near',
      label: '3 – 6 Months',
      daysLeft,
      relativeText: `Matures in ~${months} mos (${daysLeft}d)`,
      isUrgent: false,
      hexColor: '#C2410C',
      bgTint: 'rgba(194, 65, 12, 0.06)',
      borderTint: '#C2410C'
    };
  } else if (daysLeft <= 365) {
    const months = Math.ceil(daysLeft / 30);
    return {
      level: 3,
      shadeClass: 'shade-medium',
      pillClass: 'pill-medium',
      label: '6 – 12 Months',
      daysLeft,
      relativeText: `Matures in ~${months} mos`,
      isUrgent: false,
      hexColor: '#D97706',
      bgTint: 'rgba(217, 119, 6, 0.05)',
      borderTint: '#D97706'
    };
  } else if (daysLeft <= 730) {
    const years = (daysLeft / 365).toFixed(1);
    return {
      level: 4,
      shadeClass: 'shade-light',
      pillClass: 'pill-light',
      label: '1 – 2 Years',
      daysLeft,
      relativeText: `Matures in ${years} yrs`,
      isUrgent: false,
      hexColor: '#CA8A04',
      bgTint: 'rgba(202, 138, 4, 0.04)',
      borderTint: '#CA8A04'
    };
  } else {
    const years = (daysLeft / 365).toFixed(1);
    return {
      level: 5,
      shadeClass: 'shade-lightest',
      pillClass: 'pill-lightest',
      label: '> 2 Years',
      daysLeft,
      relativeText: `Matures in ${years} yrs`,
      isUrgent: false,
      hexColor: '#0284C7',
      bgTint: 'rgba(2, 132, 199, 0.04)',
      borderTint: '#0284C7'
    };
  }
}
