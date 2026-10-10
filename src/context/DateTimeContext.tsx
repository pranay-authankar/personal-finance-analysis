import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  getLocalDateString,
  formatTimeDisplay,
  formatHeaderDate,
  formatDate,
  getDaysDiff,
  isDateOverdue,
  isDateToday
} from '../utils/dateUtils';

export interface DateTimeContextValue {
  now: Date;
  todayStr: string; // YYYY-MM-DD in local time
  dateDisplay: string; // "Sun, 11 Oct 2026"
  timeDisplay: string; // "01:58:22 AM"
  timezoneName: string; // e.g. "Asia/Kolkata" or device local timezone
  midnightTicker: number; // Increments on midnight rollover to trigger global refresh
  getDaysDiff: (targetDateStr?: string | null) => number | null;
  isOverdue: (targetDateStr?: string | null) => boolean;
  isToday: (targetDateStr?: string | null) => boolean;
  formatDate: (dateStr?: string | null) => string;
  getLocalDateString: (date?: Date) => string;
}

const DateTimeContext = createContext<DateTimeContextValue | undefined>(undefined);

export const DateTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [midnightTicker, setMidnightTicker] = useState<number>(0);
  const lastDateStrRef = useRef<string>(getLocalDateString(new Date()));

  useEffect(() => {
    // 1-second interval for real-time live clock
    const timer = setInterval(() => {
      const current = new Date();
      setNow(current);

      const currentDateStr = getLocalDateString(current);
      if (currentDateStr !== lastDateStrRef.current) {
        // Midnight rollover detected!
        lastDateStrRef.current = currentDateStr;
        setMidnightTicker((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => getLocalDateString(now), [now]);
  const dateDisplay = useMemo(() => formatHeaderDate(now), [now]);
  const timeDisplay = useMemo(() => formatTimeDisplay(now), [now]);
  const timezoneName = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    } catch {
      return 'Local';
    }
  }, []);

  const value = useMemo<DateTimeContextValue>(() => {
    return {
      now,
      todayStr,
      dateDisplay,
      timeDisplay,
      timezoneName,
      midnightTicker,
      getDaysDiff: (target) => getDaysDiff(target, now),
      isOverdue: (target) => isDateOverdue(target, now),
      isToday: (target) => isDateToday(target, now),
      formatDate: (d) => formatDate(d),
      getLocalDateString
    };
  }, [now, todayStr, dateDisplay, timeDisplay, timezoneName, midnightTicker]);

  return <DateTimeContext.Provider value={value}>{children}</DateTimeContext.Provider>;
};

export const useDateTime = (): DateTimeContextValue => {
  const context = useContext(DateTimeContext);
  if (!context) {
    throw new Error('useDateTime must be used within a DateTimeProvider');
  }
  return context;
};
