import React from 'react';
import type { FixedDeposit } from '../types';
import { calculateFDValues, formatCurrency, formatDate } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { Landmark, Image as ImageIcon, ChevronRight } from 'lucide-react';

interface FdCardProps {
  fd: FixedDeposit;
  onClick: () => void;
}

export const FdCard: React.FC<FdCardProps> = ({ fd, onClick }) => {
  const calc = calculateFDValues(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate);
  const mat = getMaturityClassification(fd.maturityDate);

  return (
    <div
      className={`fd-desktop-card ${mat.shadeClass}`}
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
          <div className="fd-bank-icon-box">
            <Landmark size={20} color="var(--brand-primary)" />
          </div>
          <div className="fd-bank-texts">
            <span className="fd-bank-name-text">{fd.bankName}</span>
            <span className="fd-acc-no-text">{fd.accountNumber || 'Verified Account'}</span>
          </div>
        </div>
        <span className="fd-interest-badge">{Number(fd.interestRate).toFixed(2)}% p.a.</span>
      </div>

      <div className="fd-card-mid">
        <div className="mid-amount-col">
          <span className="val-kicker">Principal Amount</span>
          <span className="card-principal-val">₹ {formatCurrency(fd.principal)}</span>
          <span className="card-payout-text">Matures to ₹ {formatCurrency(calc.maturityAmount)}</span>
        </div>

        <div className="mid-date-col">
          <span className="val-kicker">Maturity Date</span>
          <span className="card-maturity-date">{formatDate(fd.maturityDate)}</span>
          <span className={`urgency-pill ${mat.pillClass}`} style={{ marginTop: '4px' }}>
            <span>●</span>
            <span>{mat.relativeText}</span>
          </span>
        </div>
      </div>

      <div className="fd-card-foot">
        <span>Tenure: <strong>{calc.tenureFormatted}</strong></span>
        {fd.photoUrl ? (
          <span className="card-photo-tag">
            <ImageIcon size={14} />
            <span>Certificate Attached</span>
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
