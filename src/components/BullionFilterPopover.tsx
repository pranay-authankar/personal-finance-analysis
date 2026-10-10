import React, { useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { BullionFilterState } from '../utils/bullionUiHelpers';

interface BullionFilterPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  filters: BullionFilterState;
  onChange: (filters: BullionFilterState) => void;
  onReset: () => void;
}

export const BullionFilterPopover: React.FC<BullionFilterPopoverProps> = ({
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
    filters.status !== 'all',
    filters.valueRange !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="bullion-filter-control-wrapper" ref={popoverRef}>
      {/* Compact Filter Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`bullion-filter-btn ${activeCount > 0 ? 'has-active' : ''} ${isOpen ? 'open' : ''}`}
        title="Filter Bullions"
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
        <div className="bullion-filter-popover fade-in">
          <div className="bullion-filter-popover-header">
            <span className="bullion-filter-popover-title">Filter Assets</span>
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
            {/* 1. Status Filter */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="bullionFilterStatus">
                Status
              </label>
              <select
                id="bullionFilterStatus"
                className="bullion-filter-select"
                value={filters.status}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    status: e.target.value as BullionFilterState['status']
                  })
                }
              >
                <option value="all">All (Held &amp; Sold)</option>
                <option value="held">Held (In Vault)</option>
                <option value="sold">Sold (Liquidated)</option>
              </select>
            </div>

            {/* 2. Purchase Value Range Filter */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="bullionFilterValue">
                Purchase Value
              </label>
              <select
                id="bullionFilterValue"
                className="bullion-filter-select"
                value={filters.valueRange}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    valueRange: e.target.value as BullionFilterState['valueRange']
                  })
                }
              >
                <option value="all">All Values</option>
                <option value="under_50k">Under ₹50,000</option>
                <option value="50k_2l">₹50,000 – ₹2,00,000</option>
                <option value="2l_5l">₹2,00,000 – ₹5,00,000</option>
                <option value="above_5l">Above ₹5,00,000</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
