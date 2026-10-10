import React from 'react';
import type { PropertyRecord, RentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  getRealEstateCategory,
  getRealEstateCategoryTheme,
  isPropertyIncomplete
} from '../utils/realEstateUiHelpers';
import { MapPin, AlertCircle, Calendar } from 'lucide-react';

interface RealEstateCardProps {
  property: PropertyRecord;
  activeRent?: RentRecord;
  isSelected?: boolean;
  onClick: () => void;
}

export const RealEstateCard: React.FC<RealEstateCardProps> = ({
  property,
  activeRent,
  isSelected = false,
  onClick
}) => {
  const category = getRealEstateCategory(property);
  const theme = getRealEstateCategoryTheme(category);
  const isIncomplete = isPropertyIncomplete(property);
  const isSold = property.property_status === 'SOLD';
  const price = Number(property.purchase_price) || 0;

  return (
    <div
      className={`re-card ${isSelected ? 'selected' : ''}`}
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
      {/* Top Header: Property Name, Type Icon, Status */}
      <div className="re-card-header">
        <div className="re-card-title-group">
          <span
            className="re-card-type-icon"
            style={{ background: theme.bgTint, borderColor: theme.borderTint }}
            title={theme.label}
          >
            {theme.icon}
          </span>
          <div className="re-card-title-wrap">
            <h3 className="re-card-name" title={property.name}>
              {property.name}
            </h3>
            <span className="re-card-type-label">
              {theme.label}
            </span>
          </div>
        </div>

        {/* Status Badge: Active or Sold */}
        <span className={`bullion-status-pill ${isSold ? 'sold' : 'held'}`}>
          <span className="bullion-status-dot" />
          <span>{isSold ? 'Sold' : 'Active'}</span>
        </span>
      </div>

      {/* Subtle Incomplete details indicator */}
      {isIncomplete && (
        <div className="bullion-incomplete-indicator" style={{ marginBottom: '10px' }}>
          <AlertCircle size={12} />
          <span>Incomplete details</span>
        </div>
      )}

      {/* Location Row */}
      <div className="re-card-location">
        <MapPin size={13} className="re-location-icon" />
        <span title={property.location || 'Location not specified'}>
          {property.location || 'Location not specified'}
        </span>
      </div>

      {/* Bottom Metrics: Purchase Price (+ Discreet Rent Due Date if rented) */}
      <div className="re-card-footer">
        <div className="re-card-price-box">
          <span className="re-card-kicker">Purchase Price</span>
          <div className="re-card-price-val">
            {price > 0 ? (
              <>
                <span className="re-currency-sign" style={{ color: theme.borderAccent }}>₹</span>
                <span>{formatCurrency(price)}</span>
              </>
            ) : (
              <span className="bullion-empty-metric">—</span>
            )}
          </div>
        </div>

        {/* Discreet Rental Badge with Next Rent Due Date if active lease */}
        {activeRent && !isSold && (
          <div className="re-card-rent-pill" title={`Tenant: ${activeRent.tenant_name}`}>
            <span className="re-rent-tag-dot" />
            <span>
              {activeRent.next_rent_due ? (
                <>
                  <Calendar size={11} style={{ marginRight: '3px' }} />
                  Due: {formatDate(activeRent.next_rent_due)}
                </>
              ) : (
                'Rented'
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
