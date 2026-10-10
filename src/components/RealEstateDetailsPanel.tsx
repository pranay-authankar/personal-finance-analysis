import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { PropertyRecord, RentRecord, DocumentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  getRealEstateCategory,
  getRealEstateCategoryTheme,
  isPropertyIncomplete,
  formatPropertyArea
} from '../utils/realEstateUiHelpers';
import { getDeadlineClassification } from '../utils/deadlinesColorMap';
import { PhotoModal } from './PhotoModal';
import { StartRentModal } from './StartRentModal';
import { SellPropertyModal } from './SellPropertyModal';
import { AddDocumentModal } from './AddDocumentModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import {
  X,
  Edit3,
  KeyRound,
  FileText,
  Trash2,
  Tag,
  MapPin,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  User,
  Phone,
  Clock,
  Wallet,
  Plus
} from 'lucide-react';

interface RealEstateDetailsPanelProps {
  property: PropertyRecord;
  activeRent?: RentRecord;
  documents?: DocumentRecord[];
  onClose?: () => void;
  onEdit?: (p: PropertyRecord) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  isDrawer?: boolean;
}

export const RealEstateDetailsPanel: React.FC<RealEstateDetailsPanelProps> = ({
  property,
  activeRent: passedActiveRent,
  documents: passedDocs,
  onClose,
  onEdit,
  onShowToast,
  isDrawer = false
}) => {
  const navigate = useNavigate();
  const {
    getActiveRentForProperty,
    getDocumentsForProperty,
    getPaymentsForProperty,
    calculatePropertyFinances,
    recordPurchasePayment,
    recordSalePayment,
    deleteProperty,
    startRent,
    stopRent,
    sellProperty,
    addDocument
  } = useInvestments();

  // Modals state
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentModalType, setPaymentModalType] = useState<'PURCHASE' | 'SALE_RECEIVED'>('PURCHASE');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  const activeRent = passedActiveRent || getActiveRentForProperty(property.p_id);
  const docs = passedDocs || getDocumentsForProperty(property.p_id);
  const finances = calculatePropertyFinances(property.p_id);
  const allPayments = getPaymentsForProperty(property.p_id);

  const purchasePayments = allPayments.filter((p) => p.payment_type === 'PURCHASE');
  const salePayments = allPayments.filter(
    (p) => (p.payment_type === 'RECEIVED' && p.payment_context === 'SALE') || p.payment_type === 'SALE_RECEIVED'
  );

  const category = getRealEstateCategory(property);
  const theme = getRealEstateCategoryTheme(category);
  const isIncomplete = isPropertyIncomplete(property);
  const isSold = property.property_status === 'SOLD';
  const price = Number(property.purchase_price) || 0;
  const deadlineClass = finances.nextDueDate ? getDeadlineClassification(finances.nextDueDate) : null;
  const isPartialPaidNoDueDate =
    !isSold &&
    price > 0 &&
    finances.totalPurchasePaid > 0 &&
    finances.totalPurchasePaid < price &&
    finances.paymentLeft > 0 &&
    !finances.nextDueDate &&
    !property.payment_deadline;

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete "${property.name}"?\n\nThis property will be removed from your portfolio.`
      )
    ) {
      deleteProperty(property.p_id);
      onShowToast(`Property "${property.name}" deleted.`, 'info');
      if (onClose) {
        onClose();
      } else {
        navigate('/real-estate');
      }
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(property);
    } else {
      navigate(`/add-property?edit=${property.p_id}`);
    }
  };

  const handleStopRent = () => {
    if (!activeRent) return;
    if (
      window.confirm(
        `End current lease with tenant "${activeRent.tenant_name}"?\n\nThe lease history will be preserved.`
      )
    ) {
      stopRent(activeRent.r_id);
      onShowToast(`Tenancy ended. Property is now vacant.`, 'info');
    }
  };

  return (
    <div className={`bullion-details-container ${isDrawer ? 'drawer-mode' : 'page-mode'}`}>
      {/* Panel Header */}
      <div className="bullion-details-header">
        <div className="bullion-details-header-main">
          <div className="bullion-details-title-row">
            <span
              className="bullion-details-icon-wrap"
              style={{ background: theme.bgTint, borderColor: theme.borderTint }}
            >
              {theme.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="bullion-details-title" title={property.name}>
                {property.name}
              </h2>
              <span className="bullion-details-subtitle">{theme.label}</span>
            </div>
            <span className={`bullion-status-pill ${isSold ? 'sold' : 'held'}`} style={{ marginLeft: 'auto' }}>
              <span className="bullion-status-dot" />
              <span>{isSold ? 'Sold' : 'Active'}</span>
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
            <span className="bullion-sold-title">Property Sold</span>
            <span className="bullion-sold-sub">
              Sale proceeds and transactions are tracked in Realized Funds.
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
              {!price && !property.location
                ? 'Purchase price and location are missing.'
                : !price
                ? 'Purchase price is not recorded.'
                : 'Property location is missing.'}
            </span>
          </div>
        </div>
      )}

      {/* Details Body */}
      <div className="bullion-details-body">
        {/* PAYMENT DUES TRACKER BANNER (Feature 4) */}
        {!isSold && price > 0 && (
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${
                finances.paymentStatus === 'missed'
                  ? '#FCA5A5'
                  : isPartialPaidNoDueDate
                  ? '#DDD6FE'
                  : finances.paymentLeft > 0
                  ? '#CBD5E1'
                  : '#A7F3D0'
              }`,
              background:
                finances.paymentStatus === 'missed'
                  ? '#FEF2F2'
                  : isPartialPaidNoDueDate
                  ? '#FAF5FF'
                  : finances.paymentLeft > 0
                  ? '#F8FAFC'
                  : '#ECFDF5',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet
                  size={18}
                  color={
                    finances.paymentStatus === 'missed'
                      ? '#DC2626'
                      : isPartialPaidNoDueDate
                      ? '#7C3AED'
                      : finances.paymentLeft > 0
                      ? 'var(--color-navy)'
                      : '#059669'
                  }
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color:
                      finances.paymentStatus === 'missed'
                        ? '#B91C1C'
                        : isPartialPaidNoDueDate
                        ? '#6D28D9'
                        : finances.paymentLeft > 0
                        ? 'var(--color-navy)'
                        : '#047857'
                  }}
                >
                  Payment Dues Tracker
                </span>
              </div>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background:
                    finances.paymentStatus === 'missed'
                      ? '#DC2626'
                      : finances.paymentLeft === 0
                      ? '#10B981'
                      : isPartialPaidNoDueDate
                      ? '#7C3AED'
                      : 'var(--color-navy)',
                  color: '#FFFFFF'
                }}
              >
                {finances.paymentStatus === 'missed'
                  ? 'Overdue'
                  : finances.paymentLeft === 0
                  ? '100% Paid'
                  : isPartialPaidNoDueDate
                  ? 'No Due Date Set'
                  : 'Pending Balance'}
              </span>
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-charcoal-muted)', textTransform: 'uppercase' }}>
                  Paid So Far
                </span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                  ₹ {formatCurrency(finances.totalPurchasePaid)}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-charcoal-muted)', textTransform: 'uppercase' }}>
                  Remaining Balance
                </span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: isPartialPaidNoDueDate ? '#6D28D9' : finances.paymentLeft > 0 ? '#B45309' : '#047857', marginTop: '2px' }}>
                  ₹ {formatCurrency(finances.paymentLeft)}
                </div>
              </div>
            </div>

            {/* Next Due Date & Action */}
            {finances.paymentLeft > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Clock size={14} color={isPartialPaidNoDueDate ? '#7C3AED' : 'var(--color-charcoal-muted)'} />
                  <span>
                    Deadline:{' '}
                    <strong>
                      {finances.nextDueDate ? formatDate(finances.nextDueDate) : 'No due date specified'}
                    </strong>
                  </span>
                  {isPartialPaidNoDueDate ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(124, 58, 237, 0.08)',
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        color: '#6D28D9'
                      }}
                    >
                      No Due Date Set
                    </span>
                  ) : deadlineClass ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: deadlineClass.bgTint,
                        border: `1px solid ${deadlineClass.borderTint}`,
                        color: deadlineClass.textDark
                      }}
                    >
                      {deadlineClass.relativeText}
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setPaymentModalType('PURCHASE');
                    setIsRecordPaymentOpen(true);
                  }}
                  style={{
                    background: finances.paymentStatus === 'missed' ? '#DC2626' : 'var(--color-navy)',
                    borderColor: finances.paymentStatus === 'missed' ? '#DC2626' : 'var(--color-navy)',
                    fontSize: '12px',
                    padding: '5px 12px'
                  }}
                >
                  <Plus size={13} style={{ marginRight: '4px' }} />
                  Record Payment
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section 1: Purchase & Location Details */}
        <div className="bullion-details-section">
          <span className="bullion-details-section-title">Purchase Details &amp; Location</span>
          <div className="bullion-details-metric-row">
            <div className="bullion-details-metric-card primary">
              <span className="bullion-details-metric-label">Purchase Price</span>
              <div className="bullion-details-metric-value">
                {price > 0 ? (
                  <>
                    <span style={{ color: theme.borderAccent, marginRight: '3px' }}>₹</span>
                    {formatCurrency(price)}
                  </>
                ) : (
                  <span style={{ fontSize: '15px', color: 'var(--color-charcoal-muted)' }}>Not recorded</span>
                )}
              </div>
              <span className="bullion-details-metric-sub">
                {price > 0 ? 'Total acquisition cost' : 'Excluded from total valuation'}
              </span>
            </div>

            <div className="bullion-details-metric-card">
              <span className="bullion-details-metric-label">Purchase Date</span>
              <div className="bullion-details-metric-value" style={{ fontSize: '17px' }}>
                {property.purchase_date ? formatDate(property.purchase_date) : 'Not specified'}
              </div>
              <span className="bullion-details-metric-sub">Acquisition date</span>
            </div>
          </div>

          {/* Location & Area Row */}
          <div className="bullion-details-specs-box">
            <div className="bullion-spec-item" style={{ gridColumn: '1 / -1' }}>
              <span className="bullion-spec-label">
                <MapPin size={12} />
                <span>Location</span>
              </span>
              <span className="bullion-spec-val" style={{ fontSize: '13px', fontWeight: 600 }}>
                {property.location || 'Location not specified'}
              </span>
            </div>
            {Boolean(property.area_sqft) && (
              <div className="bullion-spec-item">
                <span className="bullion-spec-label">Area / Size</span>
                <span className="bullion-spec-val">
                  {formatPropertyArea(property.area_sqft, property.area_unit)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Purchase Payments Tracker (Feature 4) */}
        <div className="bullion-details-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="bullion-details-section-title">
              Payment Tracker ({purchasePayments.length})
            </span>
            {!isSold && finances.paymentLeft > 0 && (
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={() => {
                  setPaymentModalType('PURCHASE');
                  setIsRecordPaymentOpen(true);
                }}
                style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--color-navy)' }}
              >
                + Record Payment
              </button>
            )}
          </div>

          {purchasePayments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {purchasePayments.map((p) => (
                <div
                  key={p.payment_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-surface-soft)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    fontSize: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#047857' }}>
                      ₹ {formatCurrency(p.amount)}
                    </div>
                    <div style={{ color: 'var(--color-charcoal-muted)', marginTop: '2px', fontSize: '11px' }}>
                      {p.payment_date ? formatDate(p.payment_date) : 'Date unrecorded'}
                      {p.notes && ` • ${p.notes}`}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: p.status === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                      color: p.status === 'PAID' ? '#047857' : '#B45309'
                    }}
                  >
                    {p.status || 'PAID'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bullion-details-doc-empty">
              <span style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)' }}>
                No milestone payments logged yet
              </span>
              {!isSold && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPaymentModalType('PURCHASE');
                    setIsRecordPaymentOpen(true);
                  }}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <Plus size={12} style={{ marginRight: '4px' }} />
                  Record Payment
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sale Proceeds Tracker (if sold) */}
        {isSold && (
          <div className="bullion-details-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="bullion-details-section-title">
                Sale Proceeds Received ({salePayments.length})
              </span>
              {finances.saleReceivableLeft > 0 && (
                <button
                  type="button"
                  className="btn btn-subtle btn-sm"
                  onClick={() => {
                    setPaymentModalType('SALE_RECEIVED');
                    setIsRecordPaymentOpen(true);
                  }}
                  style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--color-navy)' }}
                >
                  + Record Sale Payment
                </button>
              )}
            </div>

            {salePayments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {salePayments.map((p) => (
                  <div
                    key={p.payment_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-surface-soft)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#047857' }}>
                        ₹ {formatCurrency(p.amount)}
                      </div>
                      <div style={{ color: 'var(--color-charcoal-muted)', marginTop: '2px', fontSize: '11px' }}>
                        {p.payment_date ? formatDate(p.payment_date) : 'Date unrecorded'}
                        {p.notes && ` • ${p.notes}`}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#047857'
                      }}
                    >
                      {p.status || 'RECEIVED'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bullion-details-doc-empty">
                <span style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)' }}>
                  Total received: ₹ {formatCurrency(finances.totalSaleReceived)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Section 3: Seller / Party Information */}
        {(property.party_name || property.party_contact) && (
          <div className="bullion-details-section">
            <span className="bullion-details-section-title">Seller / Party Information</span>
            <div className="bullion-details-specs-box">
              <div className="bullion-spec-item">
                <span className="bullion-spec-label">
                  <User size={12} />
                  <span>Seller / Party Name</span>
                </span>
                <span className="bullion-spec-val">
                  {property.party_name || 'Not specified'}
                </span>
              </div>

              <div className="bullion-spec-item">
                <span className="bullion-spec-label">
                  <Phone size={12} />
                  <span>Contact Phone</span>
                </span>
                <span className="bullion-spec-val">
                  {property.party_contact || 'Not specified'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Linked Rental Details */}
        <div className="bullion-details-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="bullion-details-section-title">Linked Rental Details</span>
            {activeRent && !isSold && (
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={handleStopRent}
                style={{ fontSize: '11px', color: '#DC2626', padding: '2px 6px' }}
              >
                End Lease
              </button>
            )}
          </div>

          {activeRent ? (
            <div className="re-rental-details-card">
              <div className="re-rental-top-row">
                <div>
                  <span className="re-rental-kicker">Tenant</span>
                  <div className="re-rental-tenant-name">{activeRent.tenant_name}</div>
                  {activeRent.tenant_contact && (
                    <span className="re-rental-contact">{activeRent.tenant_contact}</span>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="re-rental-kicker">Monthly Rent</span>
                  <div className="re-rental-amount">
                    ₹ {formatCurrency(Number(activeRent.rent_amount))}
                    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-charcoal-muted)' }}>/mo</span>
                  </div>
                </div>
              </div>

              <div className="re-rental-dates-row">
                <div className="re-rental-date-item">
                  <span className="re-rental-kicker">Lease Period</span>
                  <span className="re-rental-date-val">
                    {formatDate(activeRent.rent_start_date)} –{' '}
                    {activeRent.rent_end_date ? formatDate(activeRent.rent_end_date) : 'Ongoing'}
                  </span>
                </div>

                {/* Next Rent Due Date clearly but discreetly shown */}
                {activeRent.next_rent_due && (
                  <div className="re-rental-due-badge">
                    <Clock size={12} />
                    <span>Next Due: <strong>{formatDate(activeRent.next_rent_due)}</strong></span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bullion-details-doc-empty">
              <span style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)' }}>
                {isSold ? 'Property sold (no active lease)' : 'Property is currently vacant (no active lease)'}
              </span>
              {!isSold && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsRentModalOpen(true)}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <KeyRound size={12} style={{ marginRight: '4px' }} />
                  Start Lease
                </button>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Notes (if present) */}
        {property.p_notes && property.p_notes.trim() && (
          <div className="bullion-details-section">
            <span className="bullion-details-section-title">Notes &amp; Description</span>
            <div className="bullion-details-notes-box">
              <p>{property.p_notes}</p>
            </div>
          </div>
        )}

        {/* Section 6: Documents */}
        <div className="bullion-details-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="bullion-details-section-title">Attached Documents ({docs.length})</span>
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => setIsAddDocModalOpen(true)}
              style={{ fontSize: '11px', padding: '2px 6px' }}
            >
              + Add
            </button>
          </div>

          {docs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {docs.map((d) => (
                <div
                  key={d.d_id}
                  className="bullion-details-doc-card"
                  onClick={() => {
                    if (d.d_link) setSelectedPhotoUrl(d.d_link);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="bullion-details-doc-icon-wrap">
                    <FileText size={18} color="var(--color-navy)" />
                  </div>
                  <div className="bullion-details-doc-info">
                    <span className="bullion-details-doc-title">{d.d_name}</span>
                    <span className="bullion-details-doc-sub">
                      {d.d_category || 'Property Document'}
                    </span>
                  </div>
                  <ExternalLink size={15} color="var(--color-charcoal-muted)" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bullion-details-doc-empty">
              <span style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)' }}>
                No deeds or tax receipts attached
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAddDocModalOpen(true)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                + Attach Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Available Actions: Edit, Manage Rent, Documents, Mark as Sold, Delete */}
      <div className="bullion-details-actions-bar" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {/* 1. Edit */}
        <button
          type="button"
          className="bullion-action-btn edit"
          onClick={handleEdit}
          title="Edit property details"
        >
          <Edit3 size={15} />
          <span>Edit</span>
        </button>

        {/* 2. Manage Rent */}
        <button
          type="button"
          className="bullion-action-btn doc"
          onClick={() => {
            if (activeRent) {
              handleStopRent();
            } else {
              setIsRentModalOpen(true);
            }
          }}
          title={activeRent ? 'End active lease' : 'Start new rent lease'}
        >
          <KeyRound size={15} />
          <span>{activeRent ? 'End Lease' : 'Start Rent'}</span>
        </button>

        {/* 3. Documents */}
        <button
          type="button"
          className="bullion-action-btn doc"
          onClick={() => setIsAddDocModalOpen(true)}
          title="Attach or manage documents"
        >
          <FileText size={15} />
          <span>Documents</span>
        </button>

        {/* 4. Mark as Sold */}
        {!isSold ? (
          <button
            type="button"
            className="bullion-action-btn sell"
            onClick={() => setIsSellModalOpen(true)}
            title="Mark property as sold and record proceeds"
          >
            <Tag size={15} />
            <span>Mark Sold</span>
          </button>
        ) : (
          <button
            type="button"
            className="bullion-action-btn disabled"
            disabled
            title="Property already sold"
          >
            <CheckCircle2 size={15} />
            <span>Sold</span>
          </button>
        )}

        {/* 5. Delete */}
        <button
          type="button"
          className="bullion-action-btn delete"
          onClick={handleDelete}
          title="Delete property"
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
      </div>

      {/* Attached Photo / Document Lightbox Modal */}
      <PhotoModal
        photoUrl={selectedPhotoUrl}
        onClose={() => setSelectedPhotoUrl(null)}
      />

      {/* Start Rent Modal */}
      <StartRentModal
        isOpen={isRentModalOpen}
        onClose={() => setIsRentModalOpen(false)}
        property={property}
        onStartRent={(rentData) => {
          startRent(property.p_id, rentData, rentData.documents);
          onShowToast(`Property rented to ${rentData.tenant_name}.`, 'success');
          setIsRentModalOpen(false);
        }}
      />

      {/* Sell Property Modal */}
      <SellPropertyModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        property={property}
        onConfirmSale={(saleData) => {
          sellProperty(property.p_id, saleData);
          onShowToast(`Property marked as sold to ${saleData.buyer_name}. Proceeds moved to Realized Funds.`, 'success');
          setIsSellModalOpen(false);
          if (onClose) onClose();
          navigate('/realized-funds');
        }}
      />

      {/* Add Document Modal */}
      <AddDocumentModal
        isOpen={isAddDocModalOpen}
        onClose={() => setIsAddDocModalOpen(false)}
        propertyName={property.name}
        onAddDocument={async (docPayload) => {
          addDocument(property.p_id, {
            d_name: docPayload.d_name,
            d_link: docPayload.d_link,
            r_id: docPayload.r_id
          });
          onShowToast(`Document "${docPayload.d_name}" attached.`, 'success');
          setIsAddDocModalOpen(false);
        }}
      />

      {/* Record Payment Modal (Feature 4) */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        propertyName={property.name}
        type={paymentModalType}
        maxRemaining={paymentModalType === 'PURCHASE' ? finances.paymentLeft : finances.saleReceivableLeft}
        fullPaymentDeadline={finances.nextDueDate}
        onRecord={(payload) => {
          if (paymentModalType === 'PURCHASE') {
            recordPurchasePayment(property.p_id, payload);
            onShowToast(`Purchase payment of ₹ ${formatCurrency(payload.amount)} recorded!`, 'success');
          } else {
            recordSalePayment(property.p_id, payload);
            onShowToast(`Sale receivable payment of ₹ ${formatCurrency(payload.amount)} received!`, 'success');
          }
          setIsRecordPaymentOpen(false);
        }}
      />
    </div>
  );
};

export default RealEstateDetailsPanel;
