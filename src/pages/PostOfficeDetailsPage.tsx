import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { SCHEME_METADATA } from '../utils/postOfficeCalculations';
import { PhotoModal } from '../components/PhotoModal';
import {
  ChevronLeft,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react';

interface PostOfficeDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const PostOfficeDetailsPage: React.FC<PostOfficeDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPostOfficeById, deletePostOffice, activeMember } = useInvestments();
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const inv = id ? getPostOfficeById(id) : undefined;

  if (!inv) {
    return (
      <div className="main-content fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>Investment Record Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
          This Post Office investment may have been removed or does not belong to {activeMember?.name}.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/post-office')}>
          Return to Post Office Dashboard
        </button>
      </div>
    );
  }

  const mat = getMaturityClassification(inv.maturityDate);
  const meta = SCHEME_METADATA[inv.schemeType] || {
    name: inv.schemeName,
    shortName: inv.schemeType,
    icon: '📮',
    color: '#EA580C',
    description: 'Post Office Small Savings Scheme'
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to remove this ${inv.schemeName} investment from your vault?`)) {
      deletePostOffice(inv.id);
      onShowToast('Post office investment removed.', 'info');
      navigate('/post-office');
    }
  };

  return (
    <div className="main-content fade-in">
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <nav className="breadcrumb-nav">
          <span className="breadcrumb-link" onClick={() => navigate('/home')}>
            Portfolio Overview
          </span>
          <span>/</span>
          <span className="breadcrumb-link" onClick={() => navigate('/post-office')}>
            Post Office Schemes
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inv.schemeName}</span>
        </nav>
      </div>

      <div className="details-page-card">
        {/* Urgency Countdown Banner (Maturity Colour Map) */}
        <div className={`details-urgency-banner ${mat.shadeClass}`}>
          <div>
            <div className="countdown-kicker">Maturity Timeline</div>
            <div className="countdown-val">{mat.relativeText}</div>
          </div>
          <span className={`urgency-pill ${mat.pillClass}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
            <span>●</span>
            <span>{mat.label}</span>
          </span>
        </div>

        <div className="details-content-body">
          {/* Header row */}
          <div className="details-bank-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="fd-bank-icon-box" style={{ width: '56px', height: '56px', fontSize: '30px', background: '#FFF7ED', borderColor: '#FED7AA' }}>
                {meta.icon}
              </div>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                  {inv.schemeName}
                </h1>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono)', marginTop: '4px' }}>
                  Account / Certificate No: {inv.accountNumber}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              {inv.interestRate ? (
                <span className="fd-interest-badge" style={{ fontSize: '15px', padding: '6px 14px', background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
                  {Number(inv.interestRate).toFixed(2)}% p.a.
                </span>
              ) : (
                <span className="fd-interest-badge">{meta.shortName}</span>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Government Backed
              </div>
            </div>
          </div>

          {/* Financial Breakdown Grid */}
          <div className="details-financial-grid">
            <div className="details-metric-item">
              <span className="val-kicker">
                {inv.schemeType === 'PPF' || inv.schemeType === 'SUKANYA'
                  ? 'Current Deposited Balance'
                  : 'Total Invested Amount'}
              </span>
              <div className="details-metric-val">₹ {formatCurrency(inv.amount)}</div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {inv.schemeType === 'RD' ? `₹ ${formatCurrency(inv.monthlyInstallment)} / month` : 'Principal value'}
              </span>
            </div>

            {/* Scheme specific payout tile */}
            {inv.monthlyPayout ? (
              <div className="details-metric-item" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                <span className="val-kicker">Monthly Guaranteed Income</span>
                <div className="details-metric-val gain">₹ {formatCurrency(inv.monthlyPayout)}</div>
                <span style={{ fontSize: '12px', color: 'var(--color-emerald)', fontWeight: 600 }}>
                  Paid into savings account each month
                </span>
              </div>
            ) : inv.quarterlyPayout ? (
              <div className="details-metric-item" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <span className="val-kicker">Quarterly Senior Benefit</span>
                <div className="details-metric-val" style={{ color: '#1D4ED8' }}>
                  ₹ {formatCurrency(inv.quarterlyPayout)}
                </div>
                <span style={{ fontSize: '12px', color: '#2563EB', fontWeight: 600 }}>
                  Credited every quarter (SCSS)
                </span>
              </div>
            ) : inv.maturityAmount ? (
              <div className="details-metric-item">
                <span className="val-kicker">Estimated Maturity Value</span>
                <div className="details-metric-val" style={{ color: 'var(--brand-primary)' }}>
                  ₹ {formatCurrency(inv.maturityAmount)}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Principal + Compounded Interest
                </span>
              </div>
            ) : (
              <div className="details-metric-item">
                <span className="val-kicker">Tax Exemption</span>
                <div className="details-metric-val" style={{ color: 'var(--color-emerald)', fontSize: '18px' }}>
                  Triple Exempt (EEE)
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tax-free returns</span>
              </div>
            )}

            <div className="details-metric-item">
              <span className="val-kicker">Branch &amp; Jurisdiction</span>
              <div className="details-metric-val" style={{ fontSize: '16px', lineHeight: 1.3 }}>
                {inv.branch || 'Head Post Office'}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Department of Posts</span>
            </div>
          </div>

          {/* Scheme-Specific Special Details */}
          {(inv.girlChildName || inv.financialYearContribution || inv.tenureYears || inv.nominee) && (
            <div style={{ marginBottom: '28px' }}>
              <h3 className="details-section-heading">Scheme Specific Particulars</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '16px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                {inv.girlChildName && (
                  <div>
                    <span className="val-kicker">Girl Child Beneficiary</span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{inv.girlChildName}</strong>
                    {inv.girlChildDob && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>DOB: {formatDate(inv.girlChildDob)}</div>
                    )}
                  </div>
                )}

                {inv.guardianName && (
                  <div>
                    <span className="val-kicker">Account Guardian</span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{inv.guardianName}</strong>
                  </div>
                )}

                {inv.financialYearContribution && (
                  <div>
                    <span className="val-kicker">Current FY Contribution</span>
                    <strong style={{ fontSize: '15px', color: '#7C3AED' }}>
                      ₹ {formatCurrency(inv.financialYearContribution)}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sec 80C Tax Benefit</div>
                  </div>
                )}

                {inv.tenureYears && (
                  <div>
                    <span className="val-kicker">Deposit Term</span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{inv.tenureYears} Years Time Deposit</strong>
                  </div>
                )}

                {inv.nominee && (
                  <div>
                    <span className="val-kicker">Registered Nominee</span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{inv.nominee}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline & Tenure Schedule */}
          <h3 className="details-section-heading">Tenure &amp; Maturity Schedule</h3>
          <div className="details-timeline-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                <Calendar size={14} />
                <span>OPENING / PURCHASE DATE</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {formatDate(inv.openingDate)}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                <Clock size={14} />
                <span>STATUS / REMAINING</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {mat.relativeText}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                <Calendar size={14} />
                <span>MATURITY DATE</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {formatDate(inv.maturityDate)}
              </div>
            </div>
          </div>

          {/* Certificate / Receipt Image Section */}
          <h3 className="details-section-heading">Passbook / Certificate Document</h3>
          <div className="certificate-preview-box">
            {inv.photoUrl ? (
              <div
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setIsPhotoModalOpen(true)}
              >
                <img src={inv.photoUrl} alt="Post Office Document" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: 'var(--brand-primary)', fontSize: '13px', fontWeight: 600 }}>
                  <ZoomIn size={16} />
                  <span>Click to expand full document view</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                <ImageIcon size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No document or passbook image attached</div>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>You can attach a passbook cover or certificate photo by editing this record.</p>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '12px' }}
                  onClick={() => navigate(`/add-post-office?edit=${inv.id}`)}
                >
                  + Attach Document Photo
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="details-actions-bar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/post-office')}
            >
              <ChevronLeft size={16} />
              <span>Back to Post Office List</span>
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
              >
                <Trash2 size={16} />
                <span>Delete Investment</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#EA580C', borderColor: '#C2410C' }}
                onClick={() => navigate(`/add-post-office?edit=${inv.id}`)}
              >
                <Edit3 size={16} />
                <span>Edit Record</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <PhotoModal
        photoUrl={isPhotoModalOpen ? inv.photoUrl || null : null}
        onClose={() => setIsPhotoModalOpen(false)}
      />
    </div>
  );
};
