import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { PostOfficeInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getPostOfficeStatus } from '../utils/postOfficeUiHelpers';
import {
  calculateMISMonthlyPayout,
  calculateSCSSQuarterlyPayout,
  calculateNextMonthlyInterestDate,
  calculateNextQuarterlyInterestDate
} from '../utils/postOfficeCalculations';
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
  Check,
  Clock,
  AlertCircle
} from 'lucide-react';

interface PostOfficeDetailsPanelProps {
  investment: PostOfficeInvestment;
  onClose?: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  isDrawer?: boolean;
}

export const PostOfficeDetailsPanel: React.FC<PostOfficeDetailsPanelProps> = ({
  investment,
  onClose,
  onShowToast,
  isDrawer = false
}) => {
  const navigate = useNavigate();
  const { deletePostOffice } = useInvestments();

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isRealizeModalOpen, setIsRealizeModalOpen] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);

  const statusInfo = getPostOfficeStatus(investment);

  const isTd = investment.schemeType === 'TD' || (investment.schemeType as string) === 'POTD';
  const isMis = investment.schemeType === 'MIS';
  const isRd = investment.schemeType === 'RD';
  const isScss = investment.schemeType === 'SCSS';

  const isClosed = Boolean(
    investment.status === 'redeemed' ||
    investment.status === 'closed' ||
    investment.actualEndDate
  );

  // Income calculations
  const misMonthlyIncome =
    investment.expectedMonthlyInterest ||
    investment.monthlyPayout ||
    calculateMISMonthlyPayout(investment.amount, investment.interestRate);

  const scssQuarterlyIncome =
    investment.expectedQuarterlyInterest ||
    investment.quarterlyPayout ||
    calculateSCSSQuarterlyPayout(investment.amount, investment.interestRate);

  const nextMisDate =
    investment.nextInterestDate ||
    calculateNextMonthlyInterestDate(investment.openingDate);

  const nextScssDate =
    investment.nextInterestDate ||
    calculateNextQuarterlyInterestDate(investment.openingDate);

  // RD Progress metrics
  const rdPaidCount = investment.depositsMadeCount || 0;
  const rdTotalCount = 60;
  const rdProgressPct = Math.min(100, Math.round((rdPaidCount / rdTotalCount) * 100));

  const handleCopyAccount = () => {
    if (investment.accountNumber) {
      navigator.clipboard.writeText(investment.accountNumber);
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 2000);
      onShowToast('Account number copied to clipboard', 'info');
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to remove this ${investment.schemeName} investment?`)) {
      deletePostOffice(investment.id);
      onShowToast('Post office investment removed.', 'info');
      if (onClose) {
        onClose();
      } else {
        navigate('/post-office');
      }
    }
  };

  const handleEdit = () => {
    navigate(`/add-post-office?edit=${investment.id}`);
  };

  const handleDocumentClick = () => {
    if (investment.photoUrl) {
      setIsPhotoModalOpen(true);
    } else {
      navigate(`/add-post-office?edit=${investment.id}`);
    }
  };

  return (
    <div className={`po-details-container ${isDrawer ? 'drawer-mode' : 'page-mode'}`}>
      {/* Panel Header */}
      <div className="po-details-header">
        <div className="po-details-header-main">
          <div className="po-details-title-row">
            <h2 className="po-details-scheme-title">
              {investment.schemeName || investment.schemeType}
            </h2>
            <span
              className="po-card-status-pill"
              style={{
                backgroundColor: statusInfo.bgColor,
                color: statusInfo.textColor,
                borderColor: statusInfo.borderColor,
                fontSize: '12px',
                padding: '4px 10px'
              }}
            >
              <span
                className="po-status-dot"
                style={{ backgroundColor: statusInfo.dotColor }}
              />
              <span>{statusInfo.label}</span>
            </span>
          </div>

          <div className="po-details-acc-row">
            <span className="po-details-acc-label">Account No:</span>
            <span className="po-details-acc-val">{investment.accountNumber || '—'}</span>
            {investment.accountNumber && (
              <button
                type="button"
                onClick={handleCopyAccount}
                className="po-details-copy-btn"
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
            className="po-details-close-btn"
            title="Close Panel"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Closed / Redeemed notice banner */}
      {isClosed && (
        <div className="po-details-closed-banner">
          <CheckCircle2 size={16} color="#047857" />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#065F46', fontSize: '13px' }}>
              Closed / Redeemed
            </span>
            <span style={{ display: 'block', color: '#047857', fontSize: '12px' }}>
              Completed on {investment.actualEndDate ? formatDate(investment.actualEndDate) : 'Scheduled Date'}.
            </span>
          </div>
        </div>
      )}

      {/* Main Details Body */}
      <div className="po-details-body">
        {/* SCHEME 1: TD Scheme Details */}
        {isTd && (
          <>
            <div className="po-details-section">
              <div className="po-details-metric-card primary">
                <span className="po-details-metric-label">Deposit Amount</span>
                <div className="po-details-metric-value">
                  <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
                  {formatCurrency(investment.amount)}
                </div>
                <span className="po-details-metric-sub">One-time deposit</span>
              </div>

              <div className="po-details-metric-card">
                <span className="po-details-metric-label">Interest Rate</span>
                <div className="po-details-metric-value">
                  {Number(investment.interestRate).toFixed(2)}%
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '4px' }}>
                    p.a.
                  </span>
                </div>
                <span className="po-details-metric-sub">
                  Tenure: {investment.tenureYears || 5} Years
                </span>
              </div>
            </div>

            <div className="po-details-info-box">
              <div className="po-details-info-row">
                <div className="po-details-info-item">
                  <span className="po-details-info-label">
                    <Calendar size={13} />
                    <span>Start Date</span>
                  </span>
                  <span className="po-details-info-val">{formatDate(investment.openingDate)}</span>
                </div>

                <div className="po-details-info-item">
                  <span className="po-details-info-label">
                    <Calendar size={13} />
                    <span>Maturity Date</span>
                  </span>
                  <span className="po-details-info-val">{formatDate(investment.maturityDate)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* SCHEME 2: MIS Scheme Details - Make Monthly Income Visually Prominent */}
        {isMis && (
          <>
            {/* Visually Prominent Monthly Income Banner */}
            <div className="po-income-highlight-card emerald">
              <span className="po-income-highlight-kicker">Guaranteed Monthly Income</span>
              <div className="po-income-highlight-value">
                <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
                {formatCurrency(misMonthlyIncome)}
                <span className="po-income-highlight-unit">/ month</span>
              </div>
              <span className="po-income-highlight-sub">
                Next payout due: {nextMisDate ? formatDate(nextMisDate) : 'Every month'}
              </span>
            </div>

            <div className="po-details-section">
              <div className="po-details-metric-card">
                <span className="po-details-metric-label">Principal Deposit</span>
                <div className="po-details-metric-value">
                  <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
                  {formatCurrency(investment.amount)}
                </div>
                <span className="po-details-metric-sub">Safe sovereign deposit</span>
              </div>

              <div className="po-details-metric-card">
                <span className="po-details-metric-label">Annual Yield</span>
                <div className="po-details-metric-value">
                  {Number(investment.interestRate).toFixed(2)}%
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '4px' }}>
                    p.a.
                  </span>
                </div>
                <span className="po-details-metric-sub">Monthly credit to SB account</span>
              </div>
            </div>

            <div className="po-details-info-box">
              <div className="po-details-info-row">
                <div className="po-details-info-item">
                  <span className="po-details-info-label">
                    <Calendar size={13} />
                    <span>Opening Date</span>
                  </span>
                  <span className="po-details-info-val">{formatDate(investment.openingDate)}</span>
                </div>

                <div className="po-details-info-item">
                  <span className="po-details-info-label">
                    <Calendar size={13} />
                    <span>Maturity Date</span>
                  </span>
                  <span className="po-details-info-val">{formatDate(investment.maturityDate)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* SCHEME 3: RD Scheme Details - Visual Progress Bar & Clear Next Deposit */}
        {isRd && (
          <>
            {/* Visual Progress Bar showing Paid / Total Installments */}
            <div className="po-rd-progress-card">
              <div className="po-rd-progress-header">
                <div>
                  <span className="po-details-metric-label">Installment Progress</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '2px' }}>
                    {rdPaidCount} of {rdTotalCount} Installments
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '8px' }}>
                      ({rdProgressPct}% paid)
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="po-details-metric-label">Total Deposited</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '2px' }}>
                    <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
                    {formatCurrency(investment.totalDepositedAmount ?? investment.amount)}
                  </div>
                </div>
              </div>

              {/* Progress bar track */}
              <div className="po-progress-track">
                <div
                  className="po-progress-fill"
                  style={{ width: `${rdProgressPct}%` }}
                />
              </div>

              {/* Missed installments warning if any */}
              {investment.missedDepositsCount ? (
                <div className="po-missed-alert">
                  <AlertCircle size={14} color="#DC2626" />
                  <span>{investment.missedDepositsCount} missed installments recorded</span>
                </div>
              ) : null}
            </div>

            {/* Clear Next Deposit Block */}
            <div className="po-next-deposit-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color="var(--color-navy)" />
                <div>
                  <span className="po-details-metric-label">Next Deposit Due</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {investment.nextDepositDate ? formatDate(investment.nextDepositDate) : 'All Installments Completed'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className="po-details-metric-label">Monthly Amount</span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>
                  <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
                  {formatCurrency(investment.monthlyDeposit || 0)}
                </div>
              </div>
            </div>

            <div className="po-details-section">
              <div className="po-details-metric-card">
                <span className="po-details-metric-label">Interest Rate</span>
                <div className="po-details-metric-value">
                  {Number(investment.interestRate).toFixed(2)}%
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '4px' }}>
                    p.a.
                  </span>
                </div>
                <span className="po-details-metric-sub">Quarterly compounded</span>
              </div>

              <div className="po-details-metric-card">
                <span className="po-details-metric-label">Maturity Date</span>
                <div className="po-details-metric-value" style={{ fontSize: '16px' }}>
                  {formatDate(investment.maturityDate)}
                </div>
                <span className="po-details-metric-sub">5-Year scheduled completion</span>
              </div>
            </div>
          </>
        )}

        {/* SCHEME 4: SCSS Scheme Details - Make Quarterly Income Visually Prominent */}
        {isScss && (
          <>
            {/* Visually Prominent Quarterly Income Banner */}
            <div className="po-income-highlight-card gold">
              <span className="po-income-highlight-kicker">Quarterly Pension Payout</span>
              <div className="po-income-highlight-value">
                <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
                {formatCurrency(scssQuarterlyIncome)}
                <span className="po-income-highlight-unit">/ quarter</span>
              </div>
              <span className="po-income-highlight-sub">
                Next payout due: {nextScssDate ? formatDate(nextScssDate) : 'End of Quarter'}
              </span>
            </div>

            <div className="po-details-section">
              <div className="po-details-metric-card">
                <span className="po-details-metric-label">Senior Citizen Deposit</span>
                <div className="po-details-metric-value">
                  <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
                  {formatCurrency(investment.amount)}
                </div>
                <span className="po-details-metric-sub">High sovereign safety</span>
              </div>

              <div className="po-details-metric-card">
                <span className="po-details-metric-label">Government Rate</span>
                <div className="po-details-metric-value">
                  {Number(investment.interestRate).toFixed(2)}%
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '4px' }}>
                    p.a.
                  </span>
                </div>
                <span className="po-details-metric-sub">Highest small savings yield</span>
              </div>
            </div>

            <div className="po-details-info-box">
              <div className="po-details-info-row">
                <div className="po-details-info-item">
                  <span className="po-details-info-label">
                    <Calendar size={13} />
                    <span>Opening Date</span>
                  </span>
                  <span className="po-details-info-val">{formatDate(investment.openingDate)}</span>
                </div>

                <div className="po-details-info-item">
                  <span className="po-details-info-label">
                    <Calendar size={13} />
                    <span>Maturity Date</span>
                  </span>
                  <span className="po-details-info-val">{formatDate(investment.maturityDate)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Documents Section */}
        <div className="po-details-doc-section">
          <span className="po-details-section-title">Documents</span>
          {investment.photoUrl ? (
            <div
              className="po-details-doc-card"
              onClick={handleDocumentClick}
              role="button"
              tabIndex={0}
            >
              <div className="po-details-doc-icon-wrap">
                <FileText size={20} color="var(--color-navy)" />
              </div>
              <div className="po-details-doc-info">
                <span className="po-details-doc-title">
                  {investment.photoDocName || 'Passbook / Certificate Document'}
                </span>
                <span className="po-details-doc-sub">Click to inspect document</span>
              </div>
              <ExternalLink size={16} color="var(--color-charcoal-muted)" />
            </div>
          ) : (
            <div className="po-details-doc-empty">
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
      <div className="po-details-actions-bar">
        {/* 1. Edit */}
        <button
          type="button"
          className="po-action-btn edit"
          onClick={handleEdit}
        >
          <Edit3 size={15} />
          <span>Edit</span>
        </button>

        {/* 2. Redeem / Break */}
        {!isClosed ? (
          <button
            type="button"
            className="po-action-btn redeem"
            onClick={() => setIsRealizeModalOpen(true)}
          >
            <Wallet size={15} />
            <span>Redeem / Close</span>
          </button>
        ) : (
          <button
            type="button"
            className="po-action-btn disabled"
            disabled
          >
            <CheckCircle2 size={15} />
            <span>Closed</span>
          </button>
        )}

        {/* 3. Documents */}
        <button
          type="button"
          className="po-action-btn doc"
          onClick={handleDocumentClick}
        >
          <FileText size={15} />
          <span>Documents</span>
        </button>

        {/* 4. Delete */}
        <button
          type="button"
          className="po-action-btn delete"
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
        assetCategory="Post Office"
        assetId={investment.id}
        assetName={`${investment.schemeName} (${investment.accountNumber})`}
        suggestedAmount={
          investment.schemeType === 'RD'
            ? investment.totalDepositedAmount ?? investment.amount
            : investment.amount
        }
        defaultReason="Matured"
        onSuccess={(amt, r) => {
          onShowToast(
            `Scheme closed. ₹${formatCurrency(amt)} moved to Realized Funds (${r}).`,
            'success'
          );
          if (onClose) onClose();
          navigate('/realized-funds');
        }}
      />
    </div>
  );
};
