import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PropertyRecord, RentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  PROPERTY_TYPE_CONFIG,
  getDeadlineClassification
} from '../utils/deadlinesColorMap';
import {
  MapPin,
  Clock,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Tag,
  AlertCircle
} from 'lucide-react';

interface RealEstateCardProps {
  property: PropertyRecord;
  activeRent?: RentRecord;
  finances: {
    totalPurchasePaid: number;
    paymentLeft: number;
    totalSaleReceived: number;
    saleReceivableLeft: number;
    nextDueDate?: string;
    dueDateType?: 'purchase_payment_due' | 'sale_receivable_due';
    paymentStatus?: 'completed' | 'pending' | 'missed';
  };
  isRentedView?: boolean;
}

export const RealEstateCard: React.FC<RealEstateCardProps> = ({
  property,
  activeRent,
  finances,
  isRentedView = false
}) => {
  const navigate = useNavigate();
  const typeConfig = PROPERTY_TYPE_CONFIG[property.p_type] || PROPERTY_TYPE_CONFIG['Land'];

  const isSold = property.property_status === 'SOLD';
  const isDeleted = property.property_status === 'DELETED';
  const isRented = Boolean(activeRent);

  const price = property.purchase_price || 0;
  const paid = isSold ? finances.totalSaleReceived : finances.totalPurchasePaid;
  const balance = isSold ? finances.saleReceivableLeft : finances.paymentLeft;
  const pctPaid = price > 0 ? Math.min(100, Math.round((paid / price) * 100)) : 0;

  // Automatically detected payment status: completed, pending, missed
  const paymentStatus = finances.paymentStatus || (balance === 0 ? 'completed' : 'pending');

  // Next deadline classification
  const deadlineClass = finances.nextDueDate ? getDeadlineClassification(finances.nextDueDate) : null;

  return (
    <div
      className="card-panel real-estate-clean-card"
      onClick={() => navigate(`/real-estate/${property.p_id}`)}
      role="button"
      tabIndex={0}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 22px',
        background: 'var(--bg-surface)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        minHeight: '235px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = isSold ? '#64748B' : typeConfig.color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        e.currentTarget.style.borderColor = 'var(--border-light)';
      }}
    >
      <div>
        {/* Top Badges Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* Property Type Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                background: typeConfig.bgColor,
                color: typeConfig.color
              }}
            >
              <span>{typeConfig.icon}</span>
              <span>{typeConfig.label}</span>
            </span>

            {/* Rented Badge */}
            {isRented && !isSold && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: '#FEF3C7',
                  color: '#B45309'
                }}
              >
                <KeyRound size={11} />
                <span>₹{formatCurrency(activeRent!.rent_amount)}/mo</span>
              </span>
            )}

            {/* Sold Badge */}
            {isSold && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: '#F1F5F9',
                  color: '#475569'
                }}
              >
                <Tag size={11} />
                <span>SOLD</span>
              </span>
            )}
          </div>

          {/* Automatic Payment Status Pill (completed, pending, missed) */}
          {!isDeleted && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                background:
                  paymentStatus === 'completed'
                    ? '#DCFCE7'
                    : paymentStatus === 'missed'
                    ? '#FEE2E2'
                    : '#EFF6FF',
                color:
                  paymentStatus === 'completed'
                    ? '#15803D'
                    : paymentStatus === 'missed'
                    ? '#991B1B'
                    : '#1E40AF',
                border: `1px solid ${
                  paymentStatus === 'completed'
                    ? '#86EFAC'
                    : paymentStatus === 'missed'
                    ? '#FCA5A5'
                    : '#BFDBFE'
                }`
              }}
            >
              {paymentStatus === 'completed' && <CheckCircle2 size={10} />}
              {paymentStatus === 'missed' && <AlertCircle size={10} />}
              {paymentStatus === 'pending' && <Clock size={10} />}
              <span>{paymentStatus}</span>
            </span>
          )}
        </div>

        {/* Property Name & Location */}
        <h3
          style={{
            fontSize: '17px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 4px 0',
            lineHeight: 1.3
          }}
        >
          {property.name}
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '14px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <MapPin size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {property.location}
            </span>
          </div>
          {property.area_sqft && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface-subtle)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)'
              }}
            >
              📏 {property.area_sqft} Sq.ft
            </span>
          )}
        </div>

        {/* Visual Valuation & Balance OR Rental Income in Rented View */}
        {isRentedView && activeRent ? (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#B45309', fontWeight: 700, letterSpacing: '0.04em' }}>
                  Monthly Rental Income
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#92400E', marginTop: '2px' }}>
                  ₹ {formatCurrency(activeRent.rent_amount)}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#B45309' }}> /mo</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Tenant
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {activeRent.tenant_name}
                </div>
              </div>
            </div>

            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#92400E'
            }}>
              <span>Next Due: <strong>{formatDate(activeRent.next_rent_due)}</strong></span>
              {activeRent.tenant_contact && (
                <span style={{ color: '#78350F' }}>📞 {activeRent.tenant_contact}</span>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Visual Valuation & Balance */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  {isSold ? 'Sale Value' : 'Property Value'}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                  ₹ {formatCurrency(price)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  {balance > 0 ? (isSold ? 'Receivable' : 'Balance Left') : 'Settled'}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: balance > 0 ? (paymentStatus === 'missed' ? '#DC2626' : '#2563EB') : '#16A34A', marginTop: '2px' }}>
                  ₹ {formatCurrency(balance > 0 ? balance : paid)}
                </div>
              </div>
            </div>

            {/* Sleek Progress Bar */}
            <div style={{ marginBottom: balance > 0 && !isDeleted ? '10px' : '14px' }}>
              <div style={{ height: '5px', background: 'var(--bg-surface-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pctPaid}%`,
                    background: pctPaid === 100 ? '#16A34A' : paymentStatus === 'missed' ? '#DC2626' : 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                <span>{pctPaid}% {isSold ? 'Received' : 'Paid'}</span>
                <span>{formatDate(property.purchase_date)}</span>
              </div>
            </div>
          </>
        )}

        {/* Always Notify User of Full Money Due Date When Status is Pending or Missed */}
        {balance > 0 && !isDeleted && (
          <div
            style={{
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              background: paymentStatus === 'missed' ? '#FEF2F2' : '#EFF6FF',
              border: `1px solid ${paymentStatus === 'missed' ? '#FECACA' : '#BFDBFE'}`,
              color: paymentStatus === 'missed' ? '#991B1B' : '#1E40AF',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px'
            }}
          >
            {paymentStatus === 'missed' ? (
              <AlertCircle size={13} style={{ flexShrink: 0, color: '#DC2626' }} />
            ) : (
              <Clock size={13} style={{ flexShrink: 0, color: '#2563EB' }} />
            )}
            <div style={{ lineHeight: 1.3 }}>
              {finances.nextDueDate ? (
                <>
                  <span style={{ fontWeight: 700 }}>
                    {isSold ? 'Receive Full Money:' : 'Give Full Money:'}
                  </span>{' '}
                  ₹ {formatCurrency(balance)} by{' '}
                  <span style={{ fontWeight: 700 }}>{formatDate(finances.nextDueDate)}</span>{' '}
                  ({deadlineClass?.relativeText})
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 700 }}>
                    {isSold ? 'Full Money Receivable:' : 'Full Money Payment:'}
                  </span>{' '}
                  ₹ {formatCurrency(balance)} remaining (Due date not set)
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Strip */}
      <div
        style={{
          borderTop: '1px solid var(--border-light)',
          paddingTop: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
          {deadlineClass && balance > 0 ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                background: deadlineClass.bgTint,
                border: `1px solid ${deadlineClass.borderTint}`,
                color: deadlineClass.textDark,
                fontWeight: 600
              }}
            >
              {deadlineClass.isOverdue ? <AlertCircle size={10} /> : <Clock size={10} />}
              <span>{isSold ? 'Receivable: ' : 'Payment: '}{deadlineClass.relativeText}</span>
            </span>
          ) : balance === 0 && price > 0 ? (
            <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={12} />
              <span>{isSold ? 'Fully Received' : 'Fully Paid'}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              Party: {property.party_name}
            </span>
          )}
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '12px',
            color: 'var(--color-primary)',
            fontWeight: 600
          }}
        >
          <span>View</span>
          <ArrowRight size={13} />
        </span>
      </div>
    </div>
  );
};
