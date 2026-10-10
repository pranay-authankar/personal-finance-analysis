import React from 'react';
import type { FixedDeposit } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { maskAccountNumber, getFdStatus } from '../utils/fdUiHelpers';
import { useDateTime } from '../context/DateTimeContext';

interface FdCardProps {
  fd: FixedDeposit;
  onClick: () => void;
  isSelected?: boolean;
}

export const FdCard: React.FC<FdCardProps> = ({ fd, onClick, isSelected }) => {
  const { now } = useDateTime();
  const statusInfo = getFdStatus(fd.maturityDate, fd.actualEndDate, fd.status, now);
  const maskedAcc = maskAccountNumber(fd.accountNumber);

  return (
    <div
      className={`fd-clean-card ${isSelected ? 'selected' : ''}`}
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
      {/* Top Header Row: Bank Name and Maturity Status Indicator */}
      <div className="fd-card-header">
        <h3 className="fd-card-bank-name" title={fd.bankName}>
          {fd.bankName}
        </h3>
        <span
          className="fd-card-status-pill"
          style={{
            backgroundColor: statusInfo.bgColor,
            color: statusInfo.textColor,
            borderColor: statusInfo.borderColor
          }}
        >
          <span
            className="fd-status-dot"
            style={{ backgroundColor: statusInfo.dotColor }}
          />
          <span>{statusInfo.label}</span>
        </span>
      </div>

      {/* Masked Account Number */}
      <div className="fd-card-account-no">
        {maskedAcc}
      </div>

      {/* Principal Amount */}
      <div className="fd-card-principal-group">
        <span className="fd-card-label">Principal</span>
        <div className="fd-card-principal-val">
          <span style={{ color: 'var(--color-gold)', marginRight: '3px' }}>₹</span>
          {formatCurrency(fd.principal)}
        </div>
      </div>

      {/* Bottom Row: Interest Rate and Maturity Date */}
      <div className="fd-card-bottom-grid">
        <div>
          <span className="fd-card-label">Interest Rate</span>
          <span className="fd-card-meta-val">
            {Number(fd.interestRate).toFixed(2)}% p.a.
          </span>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span className="fd-card-label">Maturity Date</span>
          <span className="fd-card-meta-val">
            {formatDate(fd.maturityDate)}
          </span>
        </div>
      </div>
    </div>
  );
};
