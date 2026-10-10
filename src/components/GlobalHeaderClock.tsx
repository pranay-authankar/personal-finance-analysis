import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useDateTime } from '../context/DateTimeContext';
import { getCalendarMonthMatrix } from '../utils/dateUtils';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const GlobalHeaderClock: React.FC = () => {
  const { now, dateDisplay, timeDisplay, timezoneName } = useDateTime();
  const [isOpen, setIsOpen] = useState(false);

  // Calendar browsing state (defaults to current month and year)
  const [viewYear, setViewYear] = useState<number>(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => now.getMonth());

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close calendar popover on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Navigate calendar months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const calendarCells = useMemo(() => {
    return getCalendarMonthMatrix(viewYear, viewMonth, now);
  }, [viewYear, viewMonth, now]);

  const isCurrentViewingMonthToday = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* 1. Global Clock & Calendar Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="global-header-clock-pill"
        title={`Live Device Time (${timezoneName}). Click to toggle monthly calendar.`}
        aria-label="Current Date and Time"
        aria-expanded={isOpen}
      >
        <span className="clock-pill-icon-group">
          <Calendar size={14} className="clock-pill-calendar-icon" />
          <span className="clock-pill-date">{dateDisplay}</span>
        </span>

        <span className="clock-pill-separator" />

        <span className="clock-pill-time-group">
          <Clock size={13} className="clock-pill-clock-icon" />
          <span className="clock-pill-time">{timeDisplay}</span>
        </span>
      </button>

      {/* 2. Classy Calendar Popover */}
      {isOpen && (
        <div className="global-calendar-popover" role="dialog" aria-label="Monthly Calendar View">
          {/* Header Controls */}
          <div className="calendar-popover-header">
            <div className="calendar-month-year-title">
              <span className="calendar-month-name">{MONTH_NAMES[viewMonth]}</span>
              <span className="calendar-year-val">{viewYear}</span>
            </div>

            <div className="calendar-nav-controls">
              {!isCurrentViewingMonthToday && (
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="calendar-today-btn"
                  title="Jump to current month"
                >
                  Today
                </button>
              )}

              <button
                type="button"
                onClick={handlePrevMonth}
                className="calendar-nav-arrow-btn"
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft size={15} />
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                className="calendar-nav-arrow-btn"
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight size={15} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="calendar-close-btn"
                title="Close calendar"
                aria-label="Close calendar"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Weekday Row */}
          <div className="calendar-weekdays-row">
            {WEEKDAY_NAMES.map((name, i) => (
              <span key={name} className={`calendar-weekday-col ${i === 0 || i === 6 ? 'weekend' : ''}`}>
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid (Read-Only) */}
          <div className="calendar-days-grid">
            {calendarCells.map((cell) => {
              const isTodayCell = cell.isToday;
              return (
                <div
                  key={cell.dateStr}
                  className={`calendar-day-cell ${
                    cell.isCurrentMonth ? 'current-month' : 'other-month'
                  } ${isTodayCell ? 'is-today' : ''}`}
                  title={isTodayCell ? `Today: ${cell.dateStr}` : cell.dateStr}
                >
                  <span className="calendar-day-number">{cell.day}</span>
                  {isTodayCell && <span className="today-sub-dot" />}
                </div>
              );
            })}
          </div>

          {/* Footer Bar: Live device time & timezone */}
          <div className="calendar-popover-footer">
            <div className="calendar-footer-live-status">
              <span className="live-status-pulse-dot" />
              <span className="live-status-text">Device Local Time</span>
            </div>
            <span className="calendar-footer-tz" title={timezoneName}>
              {timezoneName}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
