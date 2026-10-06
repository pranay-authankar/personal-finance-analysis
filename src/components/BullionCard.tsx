import React from 'react';
import type { BullionInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getBullionMetadata, getEffectiveBullionValue, hasSufficientValue } from '../utils/bullionCalculations';
import { getDeadlineClassification } from '../utils/deadlinesColorMap';
import { AlertCircle, Calendar, Scale, Image as ImageIcon, ChevronRight, Clock } from 'lucide-react';

interface BullionCardProps {
  investment: BullionInvestment;
  onClick: () => void;
}

export const BullionCard: React.FC<BullionCardProps> = ({ investment, onClick }) => {
  const isComplete = hasSufficientValue(investment);
  const effectiveValue = getEffectiveBullionValue(investment);
  const meta = getBullionMetadata(investment.typeName || investment.type);
  const deadline = investment.paymentDueDate ? getDeadlineClassification(investment.paymentDueDate) : null;

  return (
    <div
      className="fd-desktop-card"
      style={{
        borderLeft: `6px solid ${meta.color}`,
        background: '#FFFFFF'
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
      <div className="fd-card-head">
        <div className="fd-bank-group">
          <div className="fd-bank-icon-box" style={{ background: meta.badgeBg, borderColor: 'transparent' }}>
            <span style={{ fontSize: '22px' }}>{meta.icon}</span>
          </div>
          <div className="fd-bank-texts">
            <span className="fd-bank-name-text">{investment.itemName}</span>
            <span className="fd-acc-no-text">{meta.name}</span>
          </div>
        </div>

        {/* Status Badge */}
        {isComplete ? (
          <span
            className="fd-interest-badge"
            style={{ background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }}
          >
            Verified Value
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: '#FFFBEB',
              color: '#B45309',
              border: '1px solid #FCD34D',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <AlertCircle size={13} />
            <span>Needs verification soon</span>
          </span>
        )}
      </div>

      <div className="fd-card-mid" style={{ background: '#F8FAFC' }}>
        <div className="mid-amount-col">
          <span className="val-kicker">Recorded / Purchase Value</span>
          {isComplete ? (
            <>
              <span className="card-principal-val">₹ {formatCurrency(effectiveValue)}</span>
              {investment.purchaseRate && (
                <span className="card-payout-text" style={{ color: 'var(--text-secondary)' }}>
                  @ ₹{formatCurrency(investment.purchaseRate)} {investment.weightUnit ? `/ ${investment.weightUnit}` : ''}
                </span>
              )}
            </>
          ) : (
            <div style={{ padding: '4px 0' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-muted)' }}>
                Value not recorded
              </span>
              <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px' }}>
                Excluded from portfolio totals
              </div>
            </div>
          )}
        </div>

        <div className="mid-date-col">
          <span className="val-kicker">Purchase / Acquisition</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <Calendar size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
              {investment.purchaseDate ? formatDate(investment.purchaseDate) : 'Not Specified'}
            </span>
          </div>

          {investment.weightDisplay || investment.weightGrams ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Scale size={13} color="var(--text-muted)" />
              <span>{investment.weightDisplay || `${investment.weightGrams}g`}</span>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Weight unrecorded
            </div>
          )}
        </div>

        {/* Payment Due Date Colour Map Strip */}
        {investment.paymentDueDate && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: deadline?.bgTint || '#EFF6FF',
              border: `1px solid ${deadline?.borderTint || '#BFDBFE'}`,
              color: deadline?.textDark || '#1E40AF',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginTop: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {deadline?.isOverdue ? (
                <AlertCircle size={13} style={{ flexShrink: 0, color: '#DC2626' }} />
              ) : (
                <Clock size={13} style={{ flexShrink: 0, color: deadline?.hexColor || '#2563EB' }} />
              )}
              <span>
                <strong>Balance Due:</strong>{' '}
                ₹ {formatCurrency(investment.remainingPayment !== undefined ? investment.remainingPayment : effectiveValue)} by{' '}
                <strong>{formatDate(investment.paymentDueDate)}</strong>
              </span>
            </div>
            {deadline && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: deadline.hexColor,
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}
              >
                {deadline.relativeText}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="fd-card-foot">
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {investment.notes ? (
            <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
              {investment.notes}
            </span>
          ) : (
            <span>Holding details</span>
          )}
        </span>

        {investment.photoUrl ? (
          <span className="card-photo-tag">
            <ImageIcon size={14} />
            <span>Receipt Attached</span>
          </span>
        ) : (
          <span style={{ color: 'var(--brand-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span>View Details</span>
            <ChevronRight size={14} />
          </span>
        )}
      </div>
    </div>
  );
};
