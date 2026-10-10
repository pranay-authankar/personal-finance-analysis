import React from 'react';
import type { RealizedTransaction } from '../utils/realizedFundsUiHelpers';
import { getAssetTypeMeta, getSourceBadgeMeta } from '../utils/realizedFundsUiHelpers';
import { formatCurrency, formatDate } from '../utils/calculations';
import { Calendar, User, FileText } from 'lucide-react';

interface RealizedFundCardProps {
  transaction: RealizedTransaction;
  onClick: () => void;
  isSelected?: boolean;
}

export const RealizedFundCard: React.FC<RealizedFundCardProps> = ({
  transaction,
  onClick,
  isSelected = false
}) => {
  const assetMeta = getAssetTypeMeta(transaction.assetType);
  const sourceMeta = getSourceBadgeMeta(transaction.source);

  return (
    <div
      className={`re-card ${isSelected ? 'selected' : ''}`}
      style={{
        borderLeftColor: transaction.source === 'Sale' ? '#D97706' : '#059669',
        cursor: 'pointer'
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
      {/* 1. Card Header */}
      <div className="re-card-header">
        <div className="re-card-title-group">
          <span
            className="re-card-type-icon"
            style={{ background: assetMeta.bgTint, borderColor: assetMeta.borderTint }}
            title={assetMeta.label}
          >
            <span style={{ fontSize: '18px' }}>{assetMeta.icon}</span>
          </span>
          <div className="re-card-title-wrap">
            <h3 className="re-card-name" title={transaction.assetName}>
              {transaction.assetName}
            </h3>
            <span className="re-card-type-label">
              {assetMeta.label} • {transaction.memberName}
            </span>
          </div>
        </div>

        {/* Source Badge (Sale / Maturity) */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: '999px',
            background: sourceMeta.bg,
            color: sourceMeta.color,
            border: `1px solid ${sourceMeta.border}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap'
          }}
          title={sourceMeta.label}
        >
          <span>{sourceMeta.icon}</span>
          <span>{sourceMeta.label}</span>
        </span>
      </div>

      {/* 2. Middle Row: Date & Member */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px', color: 'var(--color-charcoal-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Calendar size={13} />
          <span>{transaction.paymentDate ? formatDate(transaction.paymentDate) : 'Date not specified'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <User size={13} />
          <span>{transaction.memberName}</span>
        </div>
      </div>

      {/* 3. Subtle notes preview if any */}
      {transaction.notes && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-charcoal-muted)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={transaction.notes}
        >
          <FileText size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{transaction.notes}</span>
        </div>
      )}

      {/* 4. Footer: Amount Received & Status Pill */}
      <div className="re-card-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '2px' }}>
        <div className="re-card-price-box">
          <span className="re-card-kicker">Amount Received</span>
          <div className="re-card-price-val">
            <span style={{ color: 'var(--color-gold)', marginRight: '3px', fontWeight: 700 }}>+ ₹</span>
            <span>{formatCurrency(transaction.amount)}</span>
          </div>
        </div>

        <span
          className="bullion-status-pill"
          style={{
            background: 'rgba(22, 163, 74, 0.08)',
            borderColor: 'rgba(22, 163, 74, 0.25)',
            color: '#15803D'
          }}
        >
          <span
            className="bullion-status-dot"
            style={{
              background: '#16A34A',
              boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.2)'
            }}
          />
          <span>Received</span>
        </span>
      </div>
    </div>
  );
};
