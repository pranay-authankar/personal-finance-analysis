import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  type RealizedTransaction,
  getAssetTypeMeta,
  getSourceBadgeMeta
} from '../utils/realizedFundsUiHelpers';
import {
  X,
  Calendar,
  User,
  Hash,
  FileText,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Coins
} from 'lucide-react';

interface RealizedFundDetailsPanelProps {
  transaction: RealizedTransaction;
  onClose?: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  isDrawer?: boolean;
}

export const RealizedFundDetailsPanel: React.FC<RealizedFundDetailsPanelProps> = ({
  transaction,
  onClose,
  onShowToast,
  isDrawer = false
}) => {
  const navigate = useNavigate();
  const { deleteRealizedFund } = useInvestments();

  const assetMeta = getAssetTypeMeta(transaction.assetType);
  const sourceMeta = getSourceBadgeMeta(transaction.source);

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to remove this realized fund transaction of ₹ ${formatCurrency(transaction.amount)} for "${transaction.assetName}"?\n\nThe entry will be removed from your received transactions history.`
      )
    ) {
      deleteRealizedFund(transaction.id);
      onShowToast(`Realized fund entry removed.`, 'info');
      if (onClose) onClose();
    }
  };

  const handleNavigateToAssetCategory = () => {
    if (transaction.assetType === 'REAL_ESTATE') navigate('/real-estate');
    else if (transaction.assetType === 'BULLION') navigate('/bullions');
    else if (transaction.assetType === 'FD') navigate('/fds');
    else if (transaction.assetType === 'POST_OFFICE') navigate('/post-office');
    else navigate('/home');
  };

  return (
    <div className={`bullion-details-container ${isDrawer ? 'drawer-mode' : 'page-mode'}`}>
      {/* 1. Panel Header */}
      <div className="bullion-details-header">
        <div className="bullion-details-header-main">
          <div className="bullion-details-title-row">
            <span
              className="bullion-details-icon-wrap"
              style={{ background: assetMeta.bgTint, borderColor: assetMeta.borderTint }}
              title={assetMeta.label}
            >
              <span style={{ fontSize: '20px' }}>{assetMeta.icon}</span>
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="bullion-details-title" title={transaction.assetName}>
                {transaction.assetName}
              </h2>
              <span className="bullion-details-subtitle">
                {assetMeta.label} • {transaction.memberName}
              </span>
            </div>

            {/* Source Pill (Sale or Maturity) */}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                background: sourceMeta.bg,
                color: sourceMeta.color,
                border: `1px solid ${sourceMeta.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
              title={sourceMeta.label}
            >
              <span>{sourceMeta.icon}</span>
              <span>{sourceMeta.label}</span>
            </span>
          </div>
        </div>

        {isDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="bullion-details-close-btn"
            title="Close Details"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* 2. Received Notice Banner */}
      <div className="bullion-details-sold-banner">
        <CheckCircle2 size={16} color="#047857" />
        <div>
          <span className="bullion-sold-title">Money Actually Received</span>
          <span className="bullion-sold-sub">
            This capital has been liquidated and realized into liquid wealth.
          </span>
        </div>
      </div>

      {/* 3. Panel Body */}
      <div className="bullion-details-body">
        {/* Hero Amount Received Metric Box */}
        <div className="bullion-details-metric-row">
          <div className="bullion-details-metric-card primary" style={{ gridColumn: '1 / -1' }}>
            <span className="bullion-details-metric-label">Amount Received</span>
            <div className="bullion-details-metric-value" style={{ fontSize: '32px' }}>
              <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>
                ₹
              </span>
              <span>{formatCurrency(transaction.amount)}</span>
            </div>
            <span className="bullion-details-metric-sub">
              Received on {transaction.paymentDate ? formatDate(transaction.paymentDate) : 'Unspecified date'}
            </span>
          </div>
        </div>

        {/* Transaction Specifications Grid */}
        <div className="bullion-details-section">
          <span className="bullion-details-section-title">Transaction Details</span>
          <div className="bullion-details-specs-box">
            <div className="bullion-spec-item">
              <span className="bullion-spec-label">
                <Coins size={12} />
                <span>Source Type</span>
              </span>
              <span className="bullion-spec-val" style={{ fontWeight: 700, color: sourceMeta.color }}>
                {sourceMeta.label}
              </span>
            </div>

            <div className="bullion-spec-item">
              <span className="bullion-spec-label">
                <Calendar size={12} />
                <span>Payment Date</span>
              </span>
              <span className="bullion-spec-val">
                {transaction.paymentDate ? formatDate(transaction.paymentDate) : 'Not specified'}
              </span>
            </div>

            <div className="bullion-spec-item">
              <span className="bullion-spec-label">
                <User size={12} />
                <span>Family Member</span>
              </span>
              <span className="bullion-spec-val" style={{ fontWeight: 600 }}>
                {transaction.memberName}
              </span>
            </div>

            <div className="bullion-spec-item">
              <span className="bullion-spec-label">
                <CheckCircle2 size={12} />
                <span>Payment Status</span>
              </span>
              <span
                className="bullion-spec-val"
                style={{
                  color: '#15803D',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#16A34A',
                    display: 'inline-block'
                  }}
                />
                <span>Received (Paid)</span>
              </span>
            </div>

            <div className="bullion-spec-item" style={{ gridColumn: '1 / -1' }}>
              <span className="bullion-spec-label">
                <Hash size={12} />
                <span>Linked Asset</span>
              </span>
              <span className="bullion-spec-val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  <strong>{transaction.assetName}</strong> ({assetMeta.label})
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleNavigateToAssetCategory}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  <ExternalLink size={12} />
                  <span>View in {assetMeta.label}</span>
                </button>
              </span>
            </div>

            <div className="bullion-spec-item" style={{ gridColumn: '1 / -1' }}>
              <span className="bullion-spec-label">
                <Hash size={12} />
                <span>Payment Reference ID</span>
              </span>
              <span className="bullion-spec-val" style={{ fontFamily: 'var(--font-family-mono)', fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>
                {transaction.id}
              </span>
            </div>
          </div>
        </div>

        {/* Notes & Remarks Section */}
        <div className="bullion-details-section">
          <span className="bullion-details-section-title">Notes &amp; Remarks</span>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: '#FFFFFF',
              fontSize: '13px',
              color: transaction.notes ? 'var(--color-navy)' : 'var(--color-charcoal-muted)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontStyle: transaction.notes ? 'normal' : 'italic'
            }}
          >
            <FileText size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-charcoal-muted)' }} />
            <span>{transaction.notes || 'No remarks recorded for this transaction.'}</span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="bullion-details-actions-bar" style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Close
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm bullion-delete-action-btn"
            onClick={handleDelete}
            title="Delete this transaction"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
