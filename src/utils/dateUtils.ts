/**
 * Global Date & Time Utilities
 * Single source of truth for device-local timezone date operations across FamilyVault.
 */

/**
 * Returns YYYY-MM-DD strictly formatted using local year, month, and day.
 * Avoids any UTC shift caused by toISOString().
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD or other date strings safely into a local Date instance
 * set to midnight 00:00:00:000 local time.
 */
export function parseLocalDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Format: YYYY-MM-DD (standard)
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(clean);
  if (isNaN(fallback.getTime())) return null;
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

/**
 * Formats a date string into readable Indian financial convention: e.g. "11 Oct 2026"
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Formats time as 12-hour with seconds and AM/PM: e.g. "01:58:22 AM"
 */
export function formatTimeDisplay(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Formats header date: e.g. "Sun, 11 Oct 2026"
 */
export function formatHeaderDate(date: Date = new Date()): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * Calculates calendar day difference between target date and reference date (default: today).
 * Positive = future, 0 = today, Negative = past / overdue.
 */
export function getDaysDiff(targetDateStr?: string | null, referenceDate: Date = new Date()): number | null {
  if (!targetDateStr) return null;
  const target = parseLocalDate(targetDateStr);
  if (!target) return null;

  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - ref.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if target date is before today (overdue)
 */
export function isDateOverdue(targetDateStr?: string | null, referenceDate: Date = new Date()): boolean {
  const diff = getDaysDiff(targetDateStr, referenceDate);
  return diff !== null && diff < 0;
}

/**
 * Checks if target date is today
 */
export function isDateToday(targetDateStr?: string | null, referenceDate: Date = new Date()): boolean {
  const diff = getDaysDiff(targetDateStr, referenceDate);
  return diff === 0;
}

/**
 * Returns month matrix for rendering the calendar view.
 */
export interface CalendarCell {
  day: number;
  monthIndex: number;
  year: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getCalendarMonthMatrix(year: number, monthIndex: number, todayDate: Date = new Date()): CalendarCell[] {
  const todayStr = getLocalDateString(todayDate);
  const firstDay = new Date(year, monthIndex, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarCell[] = [];

  // Previous month filler days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    const m = monthIndex === 0 ? 11 : monthIndex - 1;
    const y = monthIndex === 0 ? year - 1 : year;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      monthIndex: m,
      year: y,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      monthIndex,
      year,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr
    });
  }

  // Next month filler days to complete grid
  const remainder = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remainder; d++) {
    const m = monthIndex === 11 ? 0 : monthIndex + 1;
    const y = monthIndex === 11 ? year + 1 : year;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      monthIndex: m,
      year: y,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr
    });
  }

  return cells;
}
