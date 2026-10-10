import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { useDateTime } from '../context/DateTimeContext';
import type { FixedDeposit } from '../types';
import { formatCurrency, formatDate, calculateFDValues } from '../utils/calculations';
import { getFdStatus } from '../utils/fdUiHelpers';
import { PhotoModal } from './PhotoModal';
import { RealizeAssetModal } from './RealizeAssetModal';
import {
  X,
  Edit3,
  Wallet,
  FileText,
  Trash2,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';

interface FdDetailsPanelProps {
  fd: FixedDeposit;
  onClose?: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  isDrawer?: boolean;
}

export const FdDetailsPanel: React.FC<FdDetailsPanelProps> = ({
  fd,
  onClose,
  onShowToast,
  isDrawer = false
}) => {
  const navigate = useNavigate();
  const { deleteFd } = useInvestments();
  const { now } = useDateTime();

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isRealizeModalOpen, setIsRealizeModalOpen] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);

  const statusInfo = getFdStatus(fd.maturityDate, fd.actualEndDate, fd.status, now);
  const calc = calculateFDValues(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate);

  const isRedeemed = Boolean(fd.status === 'redeemed' || fd.actualEndDate);

  const handleCopyAccount = () => {
    if (fd.accountNumber) {
      navigator.clipboard.writeText(fd.accountNumber);
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 2000);
      onShowToast('Account number copied to clipboard', 'info');
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this Fixed Deposit at ${fd.bankName}?`)) {
      deleteFd(fd.id);
      onShowToast('Fixed deposit record removed.', 'info');
      if (onClose) {
        onClose();
      } else {
        navigate('/fds');
      }
    }
  };

  const handleEdit = () => {
    navigate(`/add-fd?edit=${fd.id}`);
  };

  const handleRedeemClick = () => {
    setIsRealizeModalOpen(true);
  };

  const handleDocumentClick = () => {
    if (fd.photoUrl) {
      setIsPhotoModalOpen(true);
    } else {
      navigate(`/add-fd?edit=${fd.id}`);
    }
  };

  return (
    <div className={`fd-details-container ${isDrawer ? 'drawer-mode' : 'page-mode'}`}>
      {/* Panel Header */}
      <div className="fd-details-header">
        <div className="fd-details-header-main">
          <div className="fd-details-title-row">
            <h2 className="fd-details-bank-name">{fd.bankName}</h2>
            <span
              className="fd-card-status-pill"
              style={{
                backgroundColor: statusInfo.bgColor,
                color: statusInfo.textColor,
                borderColor: statusInfo.borderColor,
                fontSize: '12px',
                padding: '4px 10px'
              }}
            >
              <span
                className="fd-status-dot"
                style={{ backgroundColor: statusInfo.dotColor }}
              />
              <span>{statusInfo.label}</span>
            </span>
          </div>
          <div className="fd-details-acc-row">
            <span className="fd-details-acc-label">Account No:</span>
            <span className="fd-details-acc-val">{fd.accountNumber || '—'}</span>
            {fd.accountNumber && (
              <button
                type="button"
                onClick={handleCopyAccount}
                className="fd-details-copy-btn"
                title="Copy Account Number"
              >
                {copiedAcc ? <Check size={13} color="#059669" /> : <Copy size={13} />}
              </button>
            )}
          </div>
        </div>

        {isDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="fd-details-close-btn"
            title="Close Panel"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Redeemed / Matured Notice Banner (if applicable) */}
      {isRedeemed && (
        <div className="fd-details-redeemed-banner">
          <CheckCircle2 size={16} color="#047857" />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#065F46', fontSize: '13px' }}>
              Redeemed / Matured
            </span>
            <span style={{ display: 'block', color: '#047857', fontSize: '12px' }}>
              Closed on {fd.actualEndDate ? formatDate(fd.actualEndDate) : 'Scheduled Date'}. Proceeds recorded in Realized Funds.
            </span>
          </div>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="fd-details-body">
        {/* Row 1: Principal & Interest Rate */}
        <div className="fd-details-section">
          <div className="fd-details-metric-card primary">
            <span className="fd-details-metric-label">Principal Amount</span>
            <div className="fd-details-metric-value">
              <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
              {formatCurrency(fd.principal)}
            </div>
            <span className="fd-details-metric-sub">Initial deposit value</span>
          </div>

          <div className="fd-details-metric-card">
            <span className="fd-details-metric-label">Interest Rate</span>
            <div className="fd-details-metric-value">
              {Number(fd.interestRate).toFixed(2)}%
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '4px' }}>
                p.a.
              </span>
            </div>
            <span className="fd-details-metric-sub">
              Est. Gain: +₹ {formatCurrency(calc.interestEarned)}
            </span>
          </div>
        </div>

        {/* Row 2: Dates Schedule */}
        <div className="fd-details-info-box">
          <div className="fd-details-info-row">
            <div className="fd-details-info-item">
              <span className="fd-details-info-label">
                <Calendar size={13} />
                <span>Start Date</span>
              </span>
              <span className="fd-details-info-val">{formatDate(fd.startDate)}</span>
            </div>

            <div className="fd-details-info-item">
              <span className="fd-details-info-label">
                <Calendar size={13} />
                <span>Maturity Date</span>
              </span>
              <span className="fd-details-info-val">{formatDate(fd.maturityDate)}</span>
            </div>

            {fd.actualEndDate && (
              <div className="fd-details-info-item">
                <span className="fd-details-info-label">
                  <CheckCircle2 size={13} />
                  <span>Actual End Date</span>
                </span>
                <span className="fd-details-info-val">{formatDate(fd.actualEndDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Documents Section */}
        <div className="fd-details-doc-section">
          <span className="fd-details-section-title">Documents</span>
          {fd.photoUrl ? (
            <div
              className="fd-details-doc-card"
              onClick={handleDocumentClick}
              role="button"
              tabIndex={0}
            >
              <div className="fd-details-doc-icon-wrap">
                <FileText size={20} color="var(--color-navy)" />
              </div>
              <div className="fd-details-doc-info">
                <span className="fd-details-doc-title">
                  {fd.photoDocName || 'FD Certificate / Receipt'}
                </span>
                <span className="fd-details-doc-sub">Click to view document</span>
              </div>
              <ExternalLink size={16} color="var(--color-charcoal-muted)" />
            </div>
          ) : (
            <div className="fd-details-doc-empty">
              <span style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)' }}>
                No document attached
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

      {/* Action Buttons Bar */}
      <div className="fd-details-actions-bar">
        {/* 1. Edit */}
        <button
          type="button"
          className="fd-action-btn edit"
          onClick={handleEdit}
        >
          <Edit3 size={15} />
          <span>Edit</span>
        </button>

        {/* 2. Redeem / Break */}
        {!isRedeemed ? (
          <button
            type="button"
            className="fd-action-btn redeem"
            onClick={handleRedeemClick}
          >
            <Wallet size={15} />
            <span>Redeem / Break</span>
          </button>
        ) : (
          <button
            type="button"
            className="fd-action-btn disabled"
            disabled
          >
            <CheckCircle2 size={15} />
            <span>Redeemed</span>
          </button>
        )}

        {/* 3. Documents */}
        <button
          type="button"
          className="fd-action-btn doc"
          onClick={handleDocumentClick}
        >
          <FileText size={15} />
          <span>Documents</span>
        </button>

        {/* 4. Delete */}
        <button
          type="button"
          className="fd-action-btn delete"
          onClick={handleDelete}
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
      </div>

      {/* Attached Photo Modal */}
      <PhotoModal
        photoUrl={isPhotoModalOpen ? fd.photoUrl || null : null}
        onClose={() => setIsPhotoModalOpen(false)}
      />

      {/* Realize Asset Modal */}
      <RealizeAssetModal
        isOpen={isRealizeModalOpen}
        onClose={() => setIsRealizeModalOpen(false)}
        assetCategory="FD"
        assetId={fd.id}
        assetName={`${fd.bankName} (${fd.accountNumber})`}
        suggestedAmount={calc.maturityAmount}
        defaultReason="Matured"
        onSuccess={(amt, r) => {
          onShowToast(
            `FD broken/redeemed. ₹${formatCurrency(amt)} moved to Realized Funds (${r}).`,
            'success'
          );
          if (onClose) onClose();
          navigate('/realized-funds');
        }}
      />
    </div>
  );
};
