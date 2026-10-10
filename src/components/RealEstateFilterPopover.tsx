import React, { useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { RealEstateFilterState } from '../utils/realEstateUiHelpers';

interface RealEstateFilterPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  filters: RealEstateFilterState;
  onChange: (filters: RealEstateFilterState) => void;
  onReset: () => void;
  availableLocations: string[];
}

export const RealEstateFilterPopover: React.FC<RealEstateFilterPopoverProps> = ({
  isOpen,
  onToggle,
  onClose,
  filters,
  onChange,
  onReset,
  availableLocations
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
    filters.location !== 'all',
    filters.priceRange !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="bullion-filter-control-wrapper" ref={popoverRef}>
      {/* Compact Filter Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`bullion-filter-btn ${activeCount > 0 ? 'has-active' : ''} ${isOpen ? 'open' : ''}`}
        title="Filter Properties"
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
            <span className="bullion-filter-popover-title">Filter Properties</span>
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
              <label className="bullion-filter-label" htmlFor="reFilterStatus">
                Status
              </label>
              <select
                id="reFilterStatus"
                className="bullion-filter-select"
                value={filters.status}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    status: e.target.value as RealEstateFilterState['status']
                  })
                }
              >
                <option value="all">All (Active &amp; Sold)</option>
                <option value="active">Active Holding</option>
                <option value="sold">Sold (Liquidated)</option>
              </select>
            </div>

            {/* 2. Location Filter */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="reFilterLocation">
                Location
              </label>
              <select
                id="reFilterLocation"
                className="bullion-filter-select"
                value={filters.location}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    location: e.target.value
                  })
                }
              >
                <option value="all">All Locations</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Purchase Price Range Filter */}
            <div className="bullion-filter-field">
              <label className="bullion-filter-label" htmlFor="reFilterPrice">
                Purchase Price
              </label>
              <select
                id="reFilterPrice"
                className="bullion-filter-select"
                value={filters.priceRange}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    priceRange: e.target.value as RealEstateFilterState['priceRange']
                  })
                }
              >
                <option value="all">All Prices</option>
                <option value="under_25l">Under ₹25 Lakhs</option>
                <option value="25l_50l">₹25L – ₹50 Lakhs</option>
                <option value="50l_1cr">₹50L – ₹1 Crore</option>
                <option value="above_1cr">Above ₹1 Crore</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
