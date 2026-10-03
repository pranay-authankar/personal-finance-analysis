import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { calculateFDValues, formatCurrency, formatDate } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { PhotoModal } from '../components/PhotoModal';
import {
  ChevronLeft,
  Edit3,
  Trash2,
  Landmark,
  Calendar,
  Clock,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react';

interface FdDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const FdDetailsPage: React.FC<FdDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getFdById, deleteFd, activeMember } = useInvestments();
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const fd = id ? getFdById(id) : undefined;

  if (!fd) {
    return (
      <div className="main-content fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>Fixed Deposit Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
          This record may have been deleted or does not belong to {activeMember?.name}.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/fds')}>
          Return to FD Dashboard
        </button>
      </div>
    );
  }

  const calc = calculateFDValues(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate);
  const mat = getMaturityClassification(fd.maturityDate);

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this Fixed Deposit at ${fd.bankName}?`)) {
      deleteFd(fd.id);
      onShowToast('Fixed deposit record removed.', 'info');
      navigate('/fds');
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
          <span className="breadcrumb-link" onClick={() => navigate('/fds')}>
            Fixed Deposits
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{fd.bankName}</span>
        </nav>
      </div>

      <div className="details-page-card">
        {/* Urgency Countdown Banner (Maturity Colour Map) */}
        <div className={`details-urgency-banner ${mat.shadeClass}`}>
          <div>
            <div className="countdown-kicker">Maturity Status</div>
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
              <div className="fd-bank-icon-box" style={{ width: '56px', height: '56px', fontSize: '28px' }}>
                <Landmark size={28} color="var(--brand-primary)" />
              </div>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                  {fd.bankName}
                </h1>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono)', marginTop: '4px' }}>
                  Account / Receipt No: {fd.accountNumber || 'Verified Account'}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="fd-interest-badge" style={{ fontSize: '15px', padding: '6px 14px' }}>
                {Number(fd.interestRate).toFixed(2)}% p.a.
              </span>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Annual Interest Rate
              </div>
            </div>
          </div>

          {/* Financial Breakdown Grid */}
          <div className="details-financial-grid">
            <div className="details-metric-item">
              <span className="val-kicker">Principal Invested</span>
              <div className="details-metric-val">₹ {formatCurrency(fd.principal)}</div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Initial deposit value</span>
            </div>

            <div className="details-metric-item">
              <span className="val-kicker">Interest Gain</span>
              <div className="details-metric-val gain">+₹ {formatCurrency(calc.interestEarned)}</div>
              <span style={{ fontSize: '12px', color: 'var(--color-emerald)', fontWeight: 600 }}>Total guaranteed profit</span>
            </div>

            <div className="details-metric-item">
              <span className="val-kicker">Total Maturity Payout</span>
              <div className="details-metric-val" style={{ color: 'var(--brand-primary)' }}>
                ₹ {formatCurrency(calc.maturityAmount)}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Principal + Compounded Interest</span>
            </div>
          </div>

          {/* Timeline & Tenure */}
          <h3 className="details-section-heading">Tenure &amp; Timeline Schedule</h3>
          <div className="details-timeline-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                <Calendar size={14} />
                <span>START DATE</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {formatDate(fd.startDate)}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                <Clock size={14} />
                <span>TENURE DURATION</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {calc.tenureFormatted} ({calc.tenureDays} Days)
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                <Calendar size={14} />
                <span>MATURITY DATE</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {formatDate(fd.maturityDate)}
              </div>
            </div>
          </div>

          {/* Certificate / Receipt Image Section */}
          <h3 className="details-section-heading">FD Certificate / Document Receipt</h3>
          <div className="certificate-preview-box">
            {fd.photoUrl ? (
              <div
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setIsPhotoModalOpen(true)}
              >
                <img src={fd.photoUrl} alt="FD Certificate" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: 'var(--brand-primary)', fontSize: '13px', fontWeight: 600 }}>
                  <ZoomIn size={16} />
                  <span>Click to expand full document view</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                <ImageIcon size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No certificate photo attached</div>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>You can upload an FD receipt image by editing this record.</p>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '12px' }}
                  onClick={() => navigate(`/add-fd?edit=${fd.id}`)}
                >
                  + Attach Certificate Photo
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="details-actions-bar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/fds')}
            >
              <ChevronLeft size={16} />
              <span>Back to FD List</span>
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
              >
                <Trash2 size={16} />
                <span>Delete FD</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/add-fd?edit=${fd.id}`)}
              >
                <Edit3 size={16} />
                <span>Edit Record</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <PhotoModal
        photoUrl={isPhotoModalOpen ? fd.photoUrl || null : null}
        onClose={() => setIsPhotoModalOpen(false)}
      />
    </div>
  );
};
