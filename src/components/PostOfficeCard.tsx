import React from 'react';
import type { PostOfficeInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { SCHEME_METADATA } from '../utils/postOfficeCalculations';
import { Mail, Image as ImageIcon, ChevronRight } from 'lucide-react';

interface PostOfficeCardProps {
  investment: PostOfficeInvestment;
  onClick: () => void;
}

export const PostOfficeCard: React.FC<PostOfficeCardProps> = ({ investment, onClick }) => {
  const mat = getMaturityClassification(investment.maturityDate);
  const meta = SCHEME_METADATA[investment.schemeType] || {
    name: investment.schemeName,
    shortName: investment.schemeType,
    icon: '📮',
    color: '#EA580C'
  };

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
          <div className="fd-bank-icon-box" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
            <span style={{ fontSize: '20px' }}>{meta.icon}</span>
          </div>
          <div className="fd-bank-texts">
            <span className="fd-bank-name-text">{investment.schemeName || meta.name}</span>
            <span className="fd-acc-no-text">{investment.accountNumber}</span>
          </div>
        </div>
        {investment.interestRate ? (
          <span className="fd-interest-badge" style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
            {Number(investment.interestRate).toFixed(2)}% p.a.
          </span>
        ) : (
          <span className="fd-interest-badge" style={{ background: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' }}>
            {meta.shortName}
          </span>
        )}
      </div>

      <div className="fd-card-mid">
        <div className="mid-amount-col">
          <span className="val-kicker">
            {investment.schemeType === 'PPF' || investment.schemeType === 'SUKANYA'
              ? 'Current Balance / Deposited'
              : 'Invested Amount'}
          </span>
          <span className="card-principal-val">₹ {formatCurrency(investment.amount)}</span>

          {/* Scheme-specific payout highlight */}
          {investment.monthlyPayout ? (
            <span className="card-payout-text">Monthly Payout: ₹ {formatCurrency(investment.monthlyPayout)}</span>
          ) : investment.quarterlyPayout ? (
            <span className="card-payout-text">Quarterly Payout: ₹ {formatCurrency(investment.quarterlyPayout)}</span>
          ) : investment.monthlyInstallment ? (
            <span className="card-payout-text">₹ {formatCurrency(investment.monthlyInstallment)} / month</span>
          ) : investment.maturityAmount ? (
            <span className="card-payout-text">Matures to ₹ {formatCurrency(investment.maturityAmount)}</span>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{investment.branch || 'Post Office'}</span>
          )}
        </div>

        <div className="mid-date-col">
          <span className="val-kicker">Maturity Date</span>
          <span className="card-maturity-date">{formatDate(investment.maturityDate)}</span>
          <span className={`urgency-pill ${mat.pillClass}`} style={{ marginTop: '4px' }}>
            <span>●</span>
            <span>{mat.relativeText}</span>
          </span>
        </div>
      </div>

      <div className="fd-card-foot">
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Mail size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {investment.branch || 'Head Post Office'}
          </span>
        </span>

        {investment.photoUrl ? (
          <span className="card-photo-tag">
            <ImageIcon size={14} />
            <span>Document Attached</span>
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
