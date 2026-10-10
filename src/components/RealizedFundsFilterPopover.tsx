import React, { useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { RealizedFundsFilterState } from '../utils/realizedFundsUiHelpers';
import type { FamilyMember } from '../types';

interface RealizedFundsFilterPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  filters: RealizedFundsFilterState;
  onChange: (filters: RealizedFundsFilterState) => void;
  onReset: () => void;
  members: FamilyMember[];
}

export const RealizedFundsFilterPopover: React.FC<RealizedFundsFilterPopoverProps> = ({
  isOpen,
  onToggle,
  onClose,
  filters,
  onChange,
  onReset,
  members
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
    filters.source !== 'all',
    filters.memberId !== 'all',
    filters.amountRange !== 'all',
    filters.dateRange !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="bullion-filter-control-wrapper" ref={popoverRef}>
      {/* Compact Filter Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`bullion-filter-btn ${activeCount > 0 ? 'has-active' : ''} ${isOpen ? 'open' : ''}`}
        title="Filter Realized Funds"
        aria-expanded={isOpen}
      >
        <SlidersHorizontal size={14} />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="bullion-filter-badge">{activeCount}</span>
        )}
      </button>

      {/* Compact Popover Menu */}
      {isOpen && (
        <div className="bullion-filter-popover fade-in" style={{ width: '310px' }}>
          <div className="bullion-filter-popover-header">
            <span className="bullion-filter-popover-title">Filter Realized Funds</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="bullion-filter-reset-link"
              >
                Reset All
              </button>
            )}
          </div>

          <div className="bullion-filter-popover-body">
            {/* 1. Source (Sale / Maturity) */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="rfFilterSource">
                Source Type
              </label>
              <select
                id="rfFilterSource"
                className="bullion-filter-select"
                value={filters.source}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    source: e.target.value as RealizedFundsFilterState['source']
                  })
                }
              >
                <option value="all">All Sources (Sales &amp; Maturities)</option>
                <option value="SALE">Asset Sales Only</option>
                <option value="MATURITY">Maturities Only</option>
              </select>
            </div>

            {/* 2. Family Member */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="rfFilterMember">
                Family Member
              </label>
              <select
                id="rfFilterMember"
                className="bullion-filter-select"
                value={filters.memberId}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    memberId: e.target.value
                  })
                }
              >
                <option value="all">All Family Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Amount Range */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="rfFilterAmount">
                Amount Received
              </label>
              <select
                id="rfFilterAmount"
                className="bullion-filter-select"
                value={filters.amountRange}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    amountRange: e.target.value as RealizedFundsFilterState['amountRange']
                  })
                }
              >
                <option value="all">All Amounts</option>
                <option value="under_1l">Under ₹1,00,000</option>
                <option value="1l_10l">₹1,00,000 – ₹10,00,000</option>
                <option value="10l_50l">₹10,00,000 – ₹50,00,000</option>
                <option value="above_50l">Above ₹50,00,000</option>
              </select>
            </div>

            {/* 4. Date Range */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="rfFilterDate">
                Payment Date
              </label>
              <select
                id="rfFilterDate"
                className="bullion-filter-select"
                value={filters.dateRange}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    dateRange: e.target.value as RealizedFundsFilterState['dateRange']
                  })
                }
              >
                <option value="all">All Time</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="last_90_days">Last 90 Days</option>
                <option value="this_year">This Year</option>
                <option value="older">Older</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
