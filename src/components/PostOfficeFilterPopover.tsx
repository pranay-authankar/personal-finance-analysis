import React, { useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface PostOfficeFilterState {
  scheme: string; // 'all' | 'TD' | 'MIS' | 'RD' | 'SCSS'
  status: string; // 'all' | 'safe' | 'approaching' | 'due' | 'missed'
  amountRange: string; // 'all' | 'under_1l' | '1l_5l' | '5l_10l' | 'above_10l'
  maturityRange: string; // 'all' | 'next_30d' | 'next_90d' | 'next_180d' | 'next_365d' | 'over_1y'
}

interface PostOfficeFilterPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  filters: PostOfficeFilterState;
  onChange: (filters: PostOfficeFilterState) => void;
  onReset: () => void;
}

export const PostOfficeFilterPopover: React.FC<PostOfficeFilterPopoverProps> = ({
  isOpen,
  onToggle,
  onClose,
  filters,
  onChange,
  onReset
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
    filters.scheme !== 'all',
    filters.status !== 'all',
    filters.amountRange !== 'all',
    filters.maturityRange !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="po-filter-control-wrapper" ref={popoverRef}>
      {/* Compact Filter Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`po-filter-btn ${activeCount > 0 ? 'has-active' : ''} ${isOpen ? 'open' : ''}`}
        title="Filter Post Office Schemes"
      >
        <SlidersHorizontal size={14} />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="po-filter-badge">{activeCount}</span>
        )}
      </button>

      {/* Compact Popover Menu */}
      {isOpen && (
        <div className="po-filter-popover fade-in">
          <div className="po-filter-popover-header">
            <span className="po-filter-popover-title">Filter Schemes</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="po-filter-reset-link"
              >
                Reset All
              </button>
            )}
          </div>

          <div className="po-filter-popover-body">
            {/* 1. Scheme Filter */}
            <div className="po-filter-field">
              <label className="po-filter-label" htmlFor="poFilterScheme">
                Scheme
              </label>
              <select
                id="poFilterScheme"
                className="po-filter-select"
                value={filters.scheme}
                onChange={(e) => onChange({ ...filters, scheme: e.target.value })}
              >
                <option value="all">All Schemes</option>
                <option value="TD">Time Deposit (TD)</option>
                <option value="MIS">Monthly Income (MIS)</option>
                <option value="RD">Recurring Deposit (RD)</option>
                <option value="SCSS">Senior Citizens (SCSS)</option>
              </select>
            </div>

            {/* 2. Status Filter */}
            <div className="po-filter-field">
              <label className="po-filter-label" htmlFor="poFilterStatus">
                Status
              </label>
              <select
                id="poFilterStatus"
                className="po-filter-select"
                value={filters.status}
                onChange={(e) => onChange({ ...filters, status: e.target.value })}
              >
                <option value="all">All Statuses</option>
                <option value="safe">Safe (&gt; 6 Months)</option>
                <option value="approaching">Approaching (1 – 6 Months)</option>
                <option value="due">Due Soon / Overdue</option>
                <option value="missed">Missed Installments (RD)</option>
              </select>
            </div>

            {/* 3. Amount Range Filter */}
            <div className="po-filter-field">
              <label className="po-filter-label" htmlFor="poFilterAmount">
                Amount
              </label>
              <select
                id="poFilterAmount"
                className="po-filter-select"
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
            <div className="po-filter-field">
              <label className="po-filter-label" htmlFor="poFilterMaturity">
                Maturity
              </label>
              <select
                id="poFilterMaturity"
                className="po-filter-select"
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
          </div>

          <div className="po-filter-popover-footer">
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
