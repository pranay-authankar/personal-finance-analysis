import React from 'react';
import type { PropertyRecord, RentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  getRealEstateCategory,
  getRealEstateCategoryTheme,
  isPropertyIncomplete,
  formatPropertyArea
} from '../utils/realEstateUiHelpers';
import { getPropertyColorMarker } from '../utils/deadlinesColorMap';
import { MapPin, AlertCircle, Calendar, Clock } from 'lucide-react';

interface RealEstateCardProps {
  property: PropertyRecord;
  activeRent?: RentRecord;
  finances?: {
    totalPurchasePaid: number;
    paymentLeft: number;
    nextDueDate?: string;
    paymentStatus: 'completed' | 'pending' | 'missed';
  };
  isSelected?: boolean;
  onClick: () => void;
}

export const RealEstateCard: React.FC<RealEstateCardProps> = ({
  property,
  activeRent,
  finances,
  isSelected = false,
  onClick
}) => {
  const category = getRealEstateCategory(property);
  const theme = getRealEstateCategoryTheme(category);
  const isIncomplete = isPropertyIncomplete(property);
  const isSold = property.property_status === 'SOLD';
  const price = Number(property.purchase_price) || 0;
  const totalPurchasePaid = finances?.totalPurchasePaid || 0;
  const paymentLeft = finances?.paymentLeft !== undefined ? finances.paymentLeft : price;
  const nextDueDate = finances?.nextDueDate || property.payment_deadline;

  const marker = getPropertyColorMarker({
    isSold,
    purchasePrice: price,
    totalPurchasePaid,
    paymentLeft,
    nextDueDate: finances?.nextDueDate,
    paymentDeadline: property.payment_deadline
  });

  const isFullyPaid = !isSold && price > 0 && paymentLeft <= 0;

  return (
    <div
      className={`re-card ${isSelected ? 'selected' : ''}`}
      style={{
        borderLeftColor: marker.color
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

        {/* Status Badge from Deadline Colour Map */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="bullion-status-pill"
            style={{
              background: marker.bgTint,
              borderColor: marker.borderTint,
              color: marker.textDark
            }}
            title={`Status: ${marker.label}`}
          >
            <span
              className="bullion-status-dot"
              style={{
                background: marker.color,
                boxShadow: `0 0 0 2px ${marker.color}33`
              }}
            />
            <span>{marker.label}</span>
          </span>
        </div>
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
        {property.area_sqft && (
          <span
            style={{
              marginLeft: '6px',
              paddingLeft: '6px',
              borderLeft: '1px solid var(--border-light)',
              fontWeight: 600,
              color: 'var(--color-charcoal-muted)',
              fontSize: '11px',
              whiteSpace: 'nowrap'
            }}
            title={`Area: ${formatPropertyArea(property.area_sqft, property.area_unit)}`}
          >
            {formatPropertyArea(property.area_sqft, property.area_unit)}
          </span>
        )}
      </div>

      {/* Bottom Metrics: Purchase Price (+ Discreet Rent Due Date or Payment Status) */}
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
        {activeRent && !isSold ? (
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
        ) : !isSold && paymentLeft > 0 && nextDueDate ? (
          <div
            className="re-card-rent-pill"
            style={{
              background: marker.bgTint,
              borderColor: marker.borderTint,
              color: marker.textDark
            }}
            title={`Balance due: ₹ ${formatCurrency(paymentLeft)}`}
          >
            <Clock size={11} style={{ marginRight: '3px' }} />
            <span>Due: {formatDate(nextDueDate)}</span>
          </div>
        ) : !isSold && paymentLeft > 0 && !nextDueDate ? (
          <div
            className="re-card-rent-pill"
            style={{
              background: marker.bgTint,
              borderColor: marker.borderTint,
              color: marker.textDark
            }}
            title={`Initial payment paid: ₹ ${formatCurrency(totalPurchasePaid)} | Balance pending: ₹ ${formatCurrency(paymentLeft)} (No due date set)`}
          >
            <Clock size={11} style={{ marginRight: '3px' }} />
            <span>No Due Date</span>
          </div>
        ) : isFullyPaid && !activeRent ? (
          <div
            className="re-card-rent-pill"
            style={{
              background: 'rgba(22, 163, 74, 0.08)',
              borderColor: 'rgba(22, 163, 74, 0.25)',
              color: '#15803D'
            }}
            title="100% Fully Paid"
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#16A34A',
                boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.2)',
                display: 'inline-block',
                marginRight: '2px'
              }}
            />
            <span>Fully Paid</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
