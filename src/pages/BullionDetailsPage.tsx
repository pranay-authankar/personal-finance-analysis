import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency, formatDate } from '../utils/calculations';
import { BULLION_METADATA, getEffectiveBullionValue, hasSufficientValue } from '../utils/bullionCalculations';
import { PhotoModal } from '../components/PhotoModal';
import { RealizeAssetModal } from '../components/RealizeAssetModal';
import {
  ChevronLeft,
  Edit3,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  Wallet
} from 'lucide-react';

interface BullionDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const BullionDetailsPage: React.FC<BullionDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBullionById, deleteBullion, activeMember } = useInvestments();
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isRealizeModalOpen, setIsRealizeModalOpen] = useState(false);

  const b = id ? getBullionById(id) : undefined;

  if (!b) {
    return (
      <div className="main-content fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>Bullion Record Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
          This bullion holding may have been removed or does not belong to {activeMember?.name}.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/bullions')}>
          Return to Bullions Dashboard
        </button>
      </div>
    );
  }

  const isComplete = hasSufficientValue(b);
  const effectiveValue = getEffectiveBullionValue(b);
  const meta = BULLION_METADATA[b.type] || {
    name: b.typeName,
    icon: '💎',
    color: '#7C3AED',
    badgeBg: '#F3E8FF',
    description: 'Precious Assets'
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this ${b.itemName} holding?`)) {
      deleteBullion(b.id);
      onShowToast('Bullion holding removed.', 'info');
      navigate('/bullions');
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
          <span className="breadcrumb-link" onClick={() => navigate('/bullions')}>
            Bullions
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{b.itemName}</span>
        </nav>
      </div>

      {/* If Sold, show Realized Funds status notice */}
      {b.status === 'sold' && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={24} color="#047857" />
            <div>
              <strong style={{ color: '#065F46', fontSize: '15px' }}>
                Asset Sold &amp; Proceeds Transferred to Realized Funds
              </strong>
              <p style={{ color: '#047857', fontSize: '13px', margin: '2px 0 0 0' }}>
                Active valuation is ₹0. Sale proceeds are tracked in Realized Funds to maintain family portfolio visibility.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/realized-funds')}
            style={{ background: 'white', color: '#047857', borderColor: '#A7F3D0', fontWeight: 600 }}
          >
            <span>View in Realized Funds &rarr;</span>
          </button>
        </div>
      )}

      <div className="details-page-card">
        {/* Verification Status Banner (Clean, NO maturity colors) */}
        {isComplete ? (
          <div
            style={{
              padding: '16px 32px',
              background: '#ECFDF5',
              borderBottom: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#065F46'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color="#059669" />
              <strong style={{ fontSize: '14px' }}>Verified Bullion Asset</strong>
              <span style={{ fontSize: '13px', color: '#047857' }}>
                — Fully included in family net worth &amp; asset allocation chart
              </span>
            </div>
            <span
              className="fd-interest-badge"
              style={{ background: 'white', color: '#059669', borderColor: '#A7F3D0' }}
            >
              Active Holding
            </span>
          </div>
        ) : (
          <div
            style={{
              padding: '16px 32px',
              background: '#FFFBEB',
              borderBottom: '1px solid #FCD34D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#92400E'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} color="#B45309" />
              <strong style={{ fontSize: '14px' }}>Needs verification soon</strong>
              <span style={{ fontSize: '13px', color: '#B45309' }}>
                — Important value or weight info is missing. Excluded from portfolio totals until price is updated.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => navigate(`/add-bullion?edit=${b.id}`)}
              style={{ background: 'white', borderColor: '#FCD34D', color: '#B45309' }}
            >
              + Update Value Info
            </button>
          </div>
        )}

        <div className="details-content-body">
          {/* Header row */}
          <div className="details-bank-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="fd-bank-icon-box" style={{ width: '56px', height: '56px', fontSize: '30px', background: meta.badgeBg, borderColor: 'transparent' }}>
                {meta.icon}
              </div>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                  {b.itemName}
                </h1>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Category: <strong>{meta.name}</strong>
                  {b.typeName && b.typeName !== meta.name && ` · ${b.typeName}`}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: meta.badgeBg,
                  color: meta.color,
                  fontWeight: 800,
                  fontSize: '14px'
                }}
              >
                {b.type}
              </span>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Physical Asset
              </div>
            </div>
          </div>

          {/* Value and Weight Metrics Grid */}
          <div className="details-financial-grid">
            <div className="details-metric-item" style={{ background: isComplete ? '#F8FAFC' : '#FFFBEB' }}>
              <span className="val-kicker">Recorded Investment Value</span>
              {isComplete ? (
                <>
                  <div className="details-metric-val" style={{ color: '#D97706' }}>
                    ₹ {formatCurrency(effectiveValue)}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Total recorded acquisition cost
                  </span>
                </>
              ) : (
                <>
                  <div className="details-metric-val" style={{ fontSize: '18px', color: '#B45309' }}>
                    Value Unrecorded
                  </div>
                  <span style={{ fontSize: '12px', color: '#B45309' }}>
                    Excluded from total portfolio value
                  </span>
                </>
              )}
            </div>

            <div className="details-metric-item">
              <span className="val-kicker">Weight / Quantity</span>
              <div className="details-metric-val">
                {b.weightDisplay || (b.weightGrams ? `${b.weightGrams} grams` : 'Unspecified')}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {b.weightGrams ? `${b.weightGrams} grams net weight` : 'Physical quantity'}
              </span>
            </div>

            <div className="details-metric-item">
              <span className="val-kicker">Purchase Rate</span>
              <div className="details-metric-val">
                {b.purchaseRate ? `₹ ${formatCurrency(b.purchaseRate)} /g` : 'Unrecorded'}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {b.purchaseRate ? `₹ ${formatCurrency(b.purchaseRate * 10)} per 10 grams` : 'Acquisition rate per gram'}
              </span>
            </div>
          </div>

          {/* Timeline & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
            <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                <Calendar size={14} />
                <span>PURCHASE / ACQUISITION DATE</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {b.purchaseDate ? formatDate(b.purchaseDate) : 'Date unrecorded'}
              </div>
            </div>

            <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                <FileText size={14} />
                <span>NOTES &amp; HALLMARK DETAILS</span>
              </div>
              <div style={{ fontSize: '14px', color: b.notes ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: b.notes ? 600 : 400 }}>
                {b.notes || 'No remarks or hallmarking notes recorded for this item.'}
              </div>
            </div>
          </div>

          {/* Receipt / Invoice Photo Section */}
          <h3 className="details-section-heading">Invoice / Purity Certificate</h3>
          <div className="certificate-preview-box">
            {b.photoUrl ? (
              <div
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setIsPhotoModalOpen(true)}
              >
                <img src={b.photoUrl} alt="Bullion Invoice" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', color: 'var(--brand-primary)', fontSize: '13px', fontWeight: 600 }}>
                  <ZoomIn size={16} />
                  <span>Click to view full receipt or certificate</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                <ImageIcon size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No receipt or certificate photo attached</div>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>You can attach a jeweller invoice, hallmark card, or photo of the item.</p>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '12px' }}
                  onClick={() => navigate(`/add-bullion?edit=${b.id}`)}
                >
                  + Attach Invoice Photo
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="details-actions-bar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/bullions')}
            >
              <ChevronLeft size={16} />
              <span>Back to Bullions</span>
            </button>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {b.status !== 'sold' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#0D9488', borderColor: '#0F766E' }}
                  onClick={() => setIsRealizeModalOpen(true)}
                >
                  <Wallet size={16} />
                  <span>Mark as Sold / Realize Funds</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
              >
                <Trash2 size={16} />
                <span>Delete Asset</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#D97706', borderColor: '#B45309' }}
                onClick={() => navigate(`/add-bullion?edit=${b.id}`)}
              >
                <Edit3 size={16} />
                <span>Edit Holding</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <PhotoModal
        photoUrl={isPhotoModalOpen ? b.photoUrl || null : null}
        onClose={() => setIsPhotoModalOpen(false)}
      />

      <RealizeAssetModal
        isOpen={isRealizeModalOpen}
        onClose={() => setIsRealizeModalOpen(false)}
        assetCategory="Bullions"
        assetId={b.id}
        assetName={`${b.typeName} — ${b.itemName}`}
        suggestedAmount={effectiveValue}
        defaultReason="Sold"
        onSuccess={(amt, r) => {
          onShowToast(`Moved ₹${formatCurrency(amt)} to Realized Funds (${r})! Removed from active Bullions.`, 'success');
          navigate('/realized-funds');
        }}
      />
    </div>
  );
};
