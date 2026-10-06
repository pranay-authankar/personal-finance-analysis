import React, { useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface FdFilterState {
  bank: string; // 'all' or bank name
  status: string; // 'all' | 'safe' | 'approaching' | 'due' | 'redeemed'
  amountRange: string; // 'all' | 'under_1l' | '1l_5l' | '5l_10l' | 'above_10l'
  maturityRange: string; // 'all' | 'next_30d' | 'next_90d' | 'next_180d' | 'next_365d' | 'over_1y'
  rateRange: string; // 'all' | 'above_7_5' | '7_to_7_5' | 'under_7'
}

interface FdFilterPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  filters: FdFilterState;
  onChange: (filters: FdFilterState) => void;
  onReset: () => void;
  availableBanks: string[];
}

export const FdFilterPopover: React.FC<FdFilterPopoverProps> = ({
  isOpen,
  onToggle,
  onClose,
  filters,
  onChange,
  onReset,
  availableBanks
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Calculate active filters count
  const activeCount = [
    filters.bank !== 'all',
    filters.status !== 'all',
    filters.amountRange !== 'all',
    filters.maturityRange !== 'all',
    filters.rateRange !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="fd-filter-control-wrapper" ref={popoverRef}>
      {/* Compact Filter Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`fd-filter-btn ${activeCount > 0 ? 'has-active' : ''} ${isOpen ? 'open' : ''}`}
        title="Filter Fixed Deposits"
      >
        <SlidersHorizontal size={14} />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="fd-filter-badge">{activeCount}</span>
        )}
      </button>

      {/* Compact Popover Menu */}
      {isOpen && (
        <div className="fd-filter-popover fade-in">
          <div className="fd-filter-popover-header">
            <span className="fd-filter-popover-title">Filter Deposits</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="fd-filter-reset-link"
              >
                Reset All
              </button>
            )}
          </div>

          <div className="fd-filter-popover-body">
            {/* 1. Bank Filter */}
            <div className="fd-filter-field">
              <label className="fd-filter-label" htmlFor="fdFilterBank">
                Bank
              </label>
              <select
                id="fdFilterBank"
                className="fd-filter-select"
                value={filters.bank}
                onChange={(e) => onChange({ ...filters, bank: e.target.value })}
              >
                <option value="all">All Banks</option>
                {availableBanks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Status Filter */}
            <div className="fd-filter-field">
              <label className="fd-filter-label" htmlFor="fdFilterStatus">
                Status
              </label>
              <select
                id="fdFilterStatus"
                className="fd-filter-select"
                value={filters.status}
                onChange={(e) => onChange({ ...filters, status: e.target.value })}
              >
                <option value="all">All Statuses</option>
                <option value="safe">Safe (&gt; 6 Months)</option>
                <option value="approaching">Approaching (1 – 6 Months)</option>
                <option value="due">Due / Overdue (≤ 30 Days)</option>
              </select>
            </div>

            {/* 3. Amount Range Filter */}
            <div className="fd-filter-field">
              <label className="fd-filter-label" htmlFor="fdFilterAmount">
                Amount
              </label>
              <select
                id="fdFilterAmount"
                className="fd-filter-select"
                value={filters.amountRange}
                onChange={(e) => onChange({ ...filters, amountRange: e.target.value })}
              >
                <option value="all">All Amounts</option>
                <option value="under_1l">Under ₹1 Lakh</option>
                <option value="1l_5l">₹1 Lakh – ₹5 Lakh</option>
                <option value="5l_10l">₹5 Lakh – ₹10 Lakh</option>
                <option value="above_10l">Above ₹10 Lakh</option>
              </select>
            </div>

            {/* 4. Maturity Schedule Filter */}
            <div className="fd-filter-field">
              <label className="fd-filter-label" htmlFor="fdFilterMaturity">
                Maturity
              </label>
              <select
                id="fdFilterMaturity"
                className="fd-filter-select"
                value={filters.maturityRange}
                onChange={(e) => onChange({ ...filters, maturityRange: e.target.value })}
              >
                <option value="all">All Maturities</option>
                <option value="next_30d">Next 30 Days</option>
                <option value="next_90d">Next 3 Months</option>
                <option value="next_180d">Next 6 Months</option>
                <option value="next_365d">Within 1 Year</option>
                <option value="over_1y">Over 1 Year</option>
              </select>
            </div>

            {/* 5. Interest Rate Filter */}
            <div className="fd-filter-field">
              <label className="fd-filter-label" htmlFor="fdFilterRate">
                Interest Rate
              </label>
              <select
                id="fdFilterRate"
                className="fd-filter-select"
                value={filters.rateRange}
                onChange={(e) => onChange({ ...filters, rateRange: e.target.value })}
              >
                <option value="all">All Interest Rates</option>
                <option value="above_7_5">≥ 7.50% p.a.</option>
                <option value="7_to_7_5">7.00% – 7.50% p.a.</option>
                <option value="under_7">&lt; 7.00% p.a.</option>
              </select>
            </div>
          </div>

          <div className="fd-filter-popover-footer">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
