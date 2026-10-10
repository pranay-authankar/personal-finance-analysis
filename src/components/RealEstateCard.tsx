import React from 'react';
import type { PropertyRecord, RentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  getRealEstateCategory,
  getRealEstateCategoryTheme,
  isPropertyIncomplete
} from '../utils/realEstateUiHelpers';
import { getDeadlineClassification } from '../utils/deadlinesColorMap';
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

  const isPartialPaidNoDueDate =
    !isSold &&
    price > 0 &&
    (finances?.totalPurchasePaid || 0) > 0 &&
    (finances?.totalPurchasePaid || 0) < price &&
    (finances?.paymentLeft || 0) > 0 &&
    !finances?.nextDueDate &&
    !property.payment_deadline;

  const deadlineClass = finances?.nextDueDate ? getDeadlineClassification(finances.nextDueDate) : null;
  const isFullyPaid = !isSold && price > 0 && (finances?.paymentLeft === 0 || (finances?.paymentLeft || 0) <= 0);

  const borderAccentColor = isPartialPaidNoDueDate
    ? '#7C3AED'
    : deadlineClass?.isOverdue
    ? '#DC2626'
    : theme.borderAccent;

  return (
    <div
      className={`re-card ${isSelected ? 'selected' : ''}`}
      style={{
        borderLeftColor: borderAccentColor
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

        {/* Status Badge: Active or Sold + No Due Date indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isPartialPaidNoDueDate && (
            <span
              className="bullion-status-pill"
              style={{
                background: 'rgba(124, 58, 237, 0.08)',
                borderColor: 'rgba(124, 58, 237, 0.25)',
                color: '#6D28D9',
                fontWeight: 600,
                fontSize: '11px',
                padding: '2px 8px'
              }}
              title={`Initial payment ₹ ${formatCurrency(finances?.totalPurchasePaid || 0)} paid; Balance pending ₹ ${formatCurrency(finances?.paymentLeft || 0)} without due date`}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#7C3AED',
                  boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.2)',
                  display: 'inline-block'
                }}
              />
              <span>No Due Date</span>
            </span>
          )}
          <span className={`bullion-status-pill ${isSold ? 'sold' : 'held'}`}>
            <span className="bullion-status-dot" />
            <span>{isSold ? 'Sold' : 'Active'}</span>
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
        ) : !isSold && finances?.paymentLeft && finances.paymentLeft > 0 && finances.nextDueDate ? (
          <div
            className="re-card-rent-pill"
            style={{
              background: deadlineClass ? deadlineClass.bgTint : finances.paymentStatus === 'missed' ? 'rgba(220, 38, 38, 0.08)' : 'rgba(181, 137, 36, 0.1)',
              borderColor: deadlineClass ? deadlineClass.borderTint : finances.paymentStatus === 'missed' ? 'rgba(220, 38, 38, 0.25)' : 'rgba(181, 137, 36, 0.3)',
              color: deadlineClass ? deadlineClass.textDark : finances.paymentStatus === 'missed' ? '#DC2626' : '#8C6615'
            }}
            title={`Balance due: ₹ ${formatCurrency(finances.paymentLeft)} (${deadlineClass?.relativeText || ''})`}
          >
            <Clock size={11} style={{ marginRight: '3px' }} />
            <span>Due: {formatDate(finances.nextDueDate)}</span>
          </div>
        ) : isPartialPaidNoDueDate ? (
          <div
            className="re-card-rent-pill"
            style={{
              background: 'rgba(124, 58, 237, 0.08)',
              borderColor: 'rgba(124, 58, 237, 0.28)',
              color: '#6D28D9'
            }}
            title={`Initial payment paid: ₹ ${formatCurrency(finances?.totalPurchasePaid || 0)} | Balance pending: ₹ ${formatCurrency(finances?.paymentLeft || 0)} (No due date set)`}
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
