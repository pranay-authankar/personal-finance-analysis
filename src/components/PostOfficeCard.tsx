import React from 'react';
import type { PostOfficeInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { maskAccountNumber, getPostOfficeStatus } from '../utils/postOfficeUiHelpers';
import { useDateTime } from '../context/DateTimeContext';
import {
  calculateMISMonthlyPayout,
  calculateSCSSQuarterlyPayout
} from '../utils/postOfficeCalculations';

interface PostOfficeCardProps {
  investment: PostOfficeInvestment;
  onClick: () => void;
  isSelected?: boolean;
}

export const PostOfficeCard: React.FC<PostOfficeCardProps> = ({
  investment,
  onClick,
  isSelected
}) => {
  const { now } = useDateTime();
  const statusInfo = getPostOfficeStatus(investment, now);
  const maskedAcc = maskAccountNumber(investment.accountNumber);

  const isTd = investment.schemeType === 'TD' || (investment.schemeType as string) === 'POTD';
  const isMis = investment.schemeType === 'MIS';
  const isRd = investment.schemeType === 'RD';
  const isScss = investment.schemeType === 'SCSS';

  // Computed payouts
  const misMonthlyIncome =
    investment.expectedMonthlyInterest ||
    investment.monthlyPayout ||
    calculateMISMonthlyPayout(investment.amount, investment.interestRate);

  const scssQuarterlyIncome =
    investment.expectedQuarterlyInterest ||
    investment.quarterlyPayout ||
    calculateSCSSQuarterlyPayout(investment.amount, investment.interestRate);

  return (
    <div
      className={`po-clean-card ${isSelected ? 'selected' : ''}`}
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
      {/* Top Header: Scheme Name & Status Badge */}
      <div className="po-card-header">
        <h3 className="po-card-title" title={investment.schemeName}>
          {investment.schemeName || investment.schemeType}
        </h3>
        <span
          className="po-card-status-pill"
          style={{
            backgroundColor: statusInfo.bgColor,
            color: statusInfo.textColor,
            borderColor: statusInfo.borderColor
          }}
        >
          <span
            className="po-status-dot"
            style={{ backgroundColor: statusInfo.dotColor }}
          />
          <span>{statusInfo.label}</span>
        </span>
      </div>

      {/* Masked Account Number */}
      <div className="po-card-account-no">
        {maskedAcc}
      </div>

      {/* SCHEME 1: TD (Deposit | Rate | Maturity | Status) */}
      {isTd && (
        <div className="po-card-content">
          <div className="po-card-principal-group">
            <span className="po-card-label">Deposit</span>
            <div className="po-card-principal-val">
              <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
              {formatCurrency(investment.amount)}
            </div>
          </div>

          <div className="po-card-bottom-grid">
            <div>
              <span className="po-card-label">Rate</span>
              <span className="po-card-meta-val">
                {Number(investment.interestRate).toFixed(2)}% p.a.
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="po-card-label">Maturity</span>
              <span className="po-card-meta-val">
                {formatDate(investment.maturityDate)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SCHEME 2: MIS (Deposit | Rate | Monthly Income | Maturity) */}
      {isMis && (
        <div className="po-card-content">
          <div className="po-card-principal-group">
            <span className="po-card-label">Deposit</span>
            <div className="po-card-principal-val">
              <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
              {formatCurrency(investment.amount)}
            </div>
          </div>

          <div className="po-card-bottom-grid" style={{ marginBottom: '10px' }}>
            <div>
              <span className="po-card-label">Rate</span>
              <span className="po-card-meta-val">
                {Number(investment.interestRate).toFixed(2)}% p.a.
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="po-card-label">Monthly Income</span>
              <span className="po-card-meta-val highlight-emerald">
                ₹ {formatCurrency(misMonthlyIncome)} / mo
              </span>
            </div>
          </div>

          <div className="po-card-bottom-grid">
            <div>
              <span className="po-card-label">Maturity</span>
              <span className="po-card-meta-val">
                {formatDate(investment.maturityDate)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SCHEME 3: RD (Monthly Deposit | Rate | Paid/Total | Next Deposit | Maturity) */}
      {isRd && (
        <div className="po-card-content">
          <div className="po-card-principal-group">
            <span className="po-card-label">Monthly Deposit</span>
            <div className="po-card-principal-val">
              <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
              {formatCurrency(investment.monthlyDeposit || 0)}
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-charcoal-muted)', marginLeft: '4px' }}>
                / mo
              </span>
            </div>
          </div>

          <div className="po-card-bottom-grid" style={{ marginBottom: '10px' }}>
            <div>
              <span className="po-card-label">Rate</span>
              <span className="po-card-meta-val">
                {Number(investment.interestRate).toFixed(2)}% p.a.
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="po-card-label">Paid / Total</span>
              <span className="po-card-meta-val">
                {investment.depositsMadeCount || 0} / 60
              </span>
            </div>
          </div>

          <div className="po-card-bottom-grid">
            <div>
              <span className="po-card-label">Next Deposit</span>
              <span className="po-card-meta-val">
                {investment.nextDepositDate ? formatDate(investment.nextDepositDate) : 'Complete'}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="po-card-label">Maturity</span>
              <span className="po-card-meta-val">
                {formatDate(investment.maturityDate)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SCHEME 4: SCSS (Deposit | Rate | Quarterly Income | Maturity) */}
      {isScss && (
        <div className="po-card-content">
          <div className="po-card-principal-group">
            <span className="po-card-label">Deposit</span>
            <div className="po-card-principal-val">
              <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
              {formatCurrency(investment.amount)}
            </div>
          </div>

          <div className="po-card-bottom-grid" style={{ marginBottom: '10px' }}>
            <div>
              <span className="po-card-label">Rate</span>
              <span className="po-card-meta-val">
                {Number(investment.interestRate).toFixed(2)}% p.a.
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="po-card-label">Quarterly Income</span>
              <span className="po-card-meta-val highlight-gold">
                ₹ {formatCurrency(scssQuarterlyIncome)} / qtr
              </span>
            </div>
          </div>

          <div className="po-card-bottom-grid">
            <div>
              <span className="po-card-label">Maturity</span>
              <span className="po-card-meta-val">
                {formatDate(investment.maturityDate)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
