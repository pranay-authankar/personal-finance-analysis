import React from 'react';
import type { BullionInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getEffectiveBullionValue } from '../utils/bullionCalculations';
import {
  getBullionCategory,
  getBullionCategoryTheme,
  isBullionIncomplete
} from '../utils/bullionUiHelpers';
import { AlertCircle, Calendar } from 'lucide-react';

interface BullionCardProps {
  investment: BullionInvestment;
  isSelected?: boolean;
  onClick: () => void;
}

export const BullionCard: React.FC<BullionCardProps> = ({
  investment,
  isSelected = false,
  onClick
}) => {
  const category = getBullionCategory(investment);
  const theme = getBullionCategoryTheme(category);
  const effectiveValue = getEffectiveBullionValue(investment);
  const isIncomplete = isBullionIncomplete(investment);
  const isSold = investment.status === 'sold';

  // Display type and item name cleanly
  const displayType = investment.typeName || investment.type || 'Precious Asset';
  const itemName = investment.itemName && investment.itemName !== displayType ? investment.itemName : '';

  return (
    <div
      className={`bullion-card ${category.toLowerCase()}-type ${isSelected ? 'selected' : ''}`}
      style={{
        borderLeftColor: theme.borderAccent
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Top Header: Asset Type & Status */}
      <div className="bullion-card-header">
        <div className="bullion-card-type-group">
          <span className="bullion-card-type-icon" style={{ background: theme.bgTint, borderColor: theme.borderTint }}>
            {theme.icon}
          </span>
          <div className="bullion-card-title-wrap">
            <h3 className="bullion-card-type-name" title={displayType}>
              {displayType}
            </h3>
            {itemName && (
              <span className="bullion-card-item-subtitle" title={itemName}>
                {itemName}
              </span>
            )}
          </div>
        </div>

        {/* Status Pill: Held or Sold */}
        <span className={`bullion-status-pill ${isSold ? 'sold' : 'held'}`}>
          <span className="bullion-status-dot" />
          <span>{isSold ? 'Sold' : 'Held'}</span>
        </span>
      </div>

      {/* Subtle "Incomplete details" indicator */}
      {isIncomplete && (
        <div className="bullion-incomplete-indicator">
          <AlertCircle size={12} />
          <span>Incomplete details</span>
        </div>
      )}

      {/* Metric Grid: Only Purchase Value & Purchase Date */}
      <div className="bullion-card-metrics">
        {/* Purchase Value */}
        <div className="bullion-metric-box">
          <span className="bullion-metric-kicker">Purchase Value</span>
          <div className="bullion-metric-val">
            {effectiveValue > 0 ? (
              <>
                <span className="bullion-currency-sign" style={{ color: theme.borderAccent }}>
                  ₹
                </span>
                <span>{formatCurrency(effectiveValue)}</span>
              </>
            ) : (
              <span className="bullion-empty-metric">—</span>
            )}
          </div>
        </div>

        {/* Purchase Date */}
        <div className="bullion-metric-box">
          <span className="bullion-metric-kicker">Purchase Date</span>
          <div className="bullion-metric-val date-val">
            {investment.purchaseDate ? (
              <span className="bullion-date-text">
                <Calendar size={13} className="bullion-date-icon" />
                <span>{formatDate(investment.purchaseDate)}</span>
              </span>
            ) : (
              <span className="bullion-empty-metric">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
