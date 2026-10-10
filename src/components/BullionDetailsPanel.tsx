import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { BullionInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getEffectiveBullionValue } from '../utils/bullionCalculations';
import {
  getBullionCategory,
  getBullionCategoryTheme,
  isBullionIncomplete
} from '../utils/bullionUiHelpers';
import { PhotoModal } from './PhotoModal';
import { RealizeAssetModal } from './RealizeAssetModal';
import {
  X,
  Edit3,
  Wallet,
  FileText,
  Trash2,
  AlertCircle,
  ExternalLink,
  Scale,
  CheckCircle2
} from 'lucide-react';

interface BullionDetailsPanelProps {
  investment: BullionInvestment;
  onClose?: () => void;
  onEdit?: (b: BullionInvestment) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  isDrawer?: boolean;
}

export const BullionDetailsPanel: React.FC<BullionDetailsPanelProps> = ({
  investment,
  onClose,
  onEdit,
  onShowToast,
  isDrawer = false
}) => {
  const navigate = useNavigate();
  const { deleteBullion } = useInvestments();

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isRealizeModalOpen, setIsRealizeModalOpen] = useState(false);

  const category = getBullionCategory(investment);
  const theme = getBullionCategoryTheme(category);
  const effectiveValue = getEffectiveBullionValue(investment);
  const isIncomplete = isBullionIncomplete(investment);
  const isSold = investment.status === 'sold';

  const displayType = investment.typeName || investment.type || 'Bullion Holding';
  const itemName = investment.itemName && investment.itemName !== displayType ? investment.itemName : '';

  const handleDelete = () => {
    const label = itemName || displayType;
    if (window.confirm(`Are you sure you want to delete this ${label} record?`)) {
      deleteBullion(investment.id);
      onShowToast(`Removed ${label} from vault.`, 'info');
      if (onClose) {
        onClose();
      } else {
        navigate('/bullions');
      }
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(investment);
    } else {
      navigate(`/add-bullion?edit=${investment.id}`);
    }
  };

  const handleDocumentClick = () => {
    if (investment.photoUrl) {
      setIsPhotoModalOpen(true);
    } else {
      handleEdit();
    }
  };

  const handleMarkAsSold = () => {
    setIsRealizeModalOpen(true);
  };

  return (
    <div className={`bullion-details-container ${isDrawer ? 'drawer-mode' : 'page-mode'}`}>
      {/* Panel Header */}
      <div className="bullion-details-header">
        <div className="bullion-details-header-main">
          <div className="bullion-details-title-row">
            <span className="bullion-details-icon-wrap" style={{ background: theme.bgTint, borderColor: theme.borderTint }}>
              {theme.icon}
            </span>
            <div>
              <h2 className="bullion-details-title">{displayType}</h2>
              {itemName && <span className="bullion-details-subtitle">{itemName}</span>}
            </div>
            <span className={`bullion-status-pill ${isSold ? 'sold' : 'held'}`} style={{ marginLeft: 'auto' }}>
              <span className="bullion-status-dot" />
              <span>{isSold ? 'Sold' : 'Held'}</span>
            </span>
          </div>
        </div>

        {isDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="bullion-details-close-btn"
            title="Close Panel"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Sold Notice Banner */}
      {isSold && (
        <div className="bullion-details-sold-banner">
          <CheckCircle2 size={16} color="#047857" />
          <div>
            <span className="bullion-sold-title">Asset Sold &amp; Realized</span>
            <span className="bullion-sold-sub">
              Proceeds from this bullion asset are tracked in Realized Funds.
            </span>
          </div>
        </div>
      )}

      {/* Incomplete Details Warning */}
      {isIncomplete && !isSold && (
        <div className="bullion-details-incomplete-banner">
          <AlertCircle size={15} color="#B45309" />
          <div style={{ flex: 1 }}>
            <span className="bullion-incomplete-title">Incomplete Details</span>
            <span className="bullion-incomplete-sub">
              {!effectiveValue && !investment.purchaseDate
                ? 'Purchase value and date are not recorded.'
                : !effectiveValue
                ? 'Purchase value is not recorded.'
                : 'Purchase date is not recorded.'}
            </span>
          </div>
        </div>
      )}

      {/* Details Body */}
      <div className="bullion-details-body">
        {/* Section 1: Purchase Information */}
        <div className="bullion-details-section">
          <span className="bullion-details-section-title">Purchase Information</span>
          <div className="bullion-details-metric-row">
            <div className="bullion-details-metric-card primary">
              <span className="bullion-details-metric-label">Purchase Value</span>
              <div className="bullion-details-metric-value">
                {effectiveValue > 0 ? (
                  <>
                    <span style={{ color: theme.borderAccent, marginRight: '3px' }}>₹</span>
                    {formatCurrency(effectiveValue)}
                  </>
                ) : (
                  <span style={{ fontSize: '15px', color: 'var(--color-charcoal-muted)' }}>Not recorded</span>
                )}
              </div>
              <span className="bullion-details-metric-sub">
                {effectiveValue > 0 ? 'Recorded acquisition cost' : 'Excluded from total valuation'}
              </span>
            </div>

            <div className="bullion-details-metric-card">
              <span className="bullion-details-metric-label">Purchase Date</span>
              <div className="bullion-details-metric-value" style={{ fontSize: '17px' }}>
                {investment.purchaseDate ? formatDate(investment.purchaseDate) : 'Not recorded'}
              </div>
              <span className="bullion-details-metric-sub">Acquisition date</span>
            </div>
          </div>

          {/* Supplementary specifications if available */}
          {(investment.weightDisplay || investment.weight || investment.purchaseRate) && (
            <div className="bullion-details-specs-box">
              {Boolean(investment.weightDisplay || investment.weight) && (
                <div className="bullion-spec-item">
                  <span className="bullion-spec-label">
                    <Scale size={12} />
                    <span>Weight / Measure</span>
                  </span>
                  <span className="bullion-spec-val">
                    {investment.weightDisplay || `${investment.weight} ${investment.weightUnit || 'g'}`}
                  </span>
                </div>
              )}
              {Boolean(investment.purchaseRate) && (
                <div className="bullion-spec-item">
                  <span className="bullion-spec-label">Purchase Rate</span>
                  <span className="bullion-spec-val">
                    ₹ {formatCurrency(Number(investment.purchaseRate))}
                    {investment.weightUnit ? ` / ${investment.weightUnit}` : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Notes (if present) */}
        {investment.notes && investment.notes.trim() && (
          <div className="bullion-details-section">
            <span className="bullion-details-section-title">Notes &amp; Description</span>
            <div className="bullion-details-notes-box">
              <p>{investment.notes}</p>
            </div>
          </div>
        )}

        {/* Section 3: Attached Documents */}
        <div className="bullion-details-section">
          <span className="bullion-details-section-title">Attached Documents</span>
          {investment.photoUrl ? (
            <div
              className="bullion-details-doc-card"
              onClick={handleDocumentClick}
              role="button"
              tabIndex={0}
            >
              <div className="bullion-details-doc-icon-wrap">
                <FileText size={18} color="var(--color-navy)" />
              </div>
              <div className="bullion-details-doc-info">
                <span className="bullion-details-doc-title">
                  Invoice / Hallmark Certificate
                </span>
                <span className="bullion-details-doc-sub">Click to view attached document</span>
              </div>
              <ExternalLink size={15} color="var(--color-charcoal-muted)" />
            </div>
          ) : (
            <div className="bullion-details-doc-empty">
              <span style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)' }}>
                No receipt or invoice attached
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleEdit}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                + Attach Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Bar: Edit, Mark as Sold, Documents, Delete */}
      <div className="bullion-details-actions-bar">
        {/* 1. Edit */}
        <button
          type="button"
          className="bullion-action-btn edit"
          onClick={handleEdit}
        >
          <Edit3 size={15} />
          <span>Edit</span>
        </button>

        {/* 2. Mark as Sold */}
        {!isSold ? (
          <button
            type="button"
            className="bullion-action-btn sell"
            onClick={handleMarkAsSold}
          >
            <Wallet size={15} />
            <span>Mark as Sold</span>
          </button>
        ) : (
          <button
            type="button"
            className="bullion-action-btn disabled"
            disabled
          >
            <CheckCircle2 size={15} />
            <span>Sold</span>
          </button>
        )}

        {/* 3. Documents */}
        <button
          type="button"
          className="bullion-action-btn doc"
          onClick={handleDocumentClick}
        >
          <FileText size={15} />
          <span>Documents</span>
        </button>

        {/* 4. Delete */}
        <button
          type="button"
          className="bullion-action-btn delete"
          onClick={handleDelete}
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
      </div>

      {/* Photo Modal */}
      <PhotoModal
        photoUrl={isPhotoModalOpen ? investment.photoUrl || null : null}
        onClose={() => setIsPhotoModalOpen(false)}
      />

      {/* Realize Asset Modal */}
      <RealizeAssetModal
        isOpen={isRealizeModalOpen}
        onClose={() => setIsRealizeModalOpen(false)}
        assetCategory="Bullions"
        assetId={investment.id}
        assetName={`${displayType}${itemName ? ` (${itemName})` : ''}`}
        suggestedAmount={effectiveValue}
        defaultReason="Sold"
        onSuccess={(amt, r) => {
          onShowToast(
            `Marked as sold. ₹${formatCurrency(amt)} proceeds moved to Realized Funds (${r}).`,
            'success'
          );
          if (onClose) onClose();
          navigate('/realized-funds');
        }}
      />
    </div>
  );
};
