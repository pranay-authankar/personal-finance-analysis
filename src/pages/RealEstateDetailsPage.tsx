import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  PROPERTY_TYPE_CONFIG,
  getDeadlineClassification
} from '../utils/deadlinesColorMap';
import { StartRentModal } from '../components/StartRentModal';
import { SellPropertyModal } from '../components/SellPropertyModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { AddDocumentModal } from '../components/AddDocumentModal';
import { PhotoModal } from '../components/PhotoModal';
import {
  MapPin,
  Clock,
  KeyRound,
  Tag,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  CheckCircle2,
  DollarSign
} from 'lucide-react';

interface RealEstateDetailsPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const RealEstateDetailsPage: React.FC<RealEstateDetailsPageProps> = ({ onShowToast }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getPropertyById,
    getRentsForProperty,
    getActiveRentForProperty,
    getPaymentsForProperty,
    getDocumentsForProperty,
    calculatePropertyFinances,
    deleteProperty,
    startRent,
    stopRent,
    sellProperty,
    recordPurchasePayment,
    recordSalePayment,
    addDocument,
    removeDocument,
    activeMember
  } = useInvestments();

  const property = id ? getPropertyById(id) : undefined;

  // Modals state
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentModalType, setPaymentModalType] = useState<'PURCHASE' | 'SALE_RECEIVED'>('PURCHASE');
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  if (!property) {
    return (
      <div className="main-content fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Property Record Not Found</h2>
        <p style={{ color: 'var(--text-muted)', margin: '8px 0 20px', fontSize: '13px' }}>
          This property holding may have been deleted or does not belong to {activeMember?.name}.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/real-estate')}>
          Return to Real Estate Dashboard
        </button>
      </div>
    );
  }

  const isSold = property.property_status === 'SOLD';
  const isDeleted = property.property_status === 'DELETED';
  const typeConfig = PROPERTY_TYPE_CONFIG[property.p_type] || PROPERTY_TYPE_CONFIG['Land'];

  const finances = calculatePropertyFinances(property.p_id);
  const activeRent = getActiveRentForProperty(property.p_id);
  const allRents = getRentsForProperty(property.p_id);
  const allPayments = getPaymentsForProperty(property.p_id);
  const purchasePayments = allPayments.filter((p) => p.payment_type === 'PURCHASE');
  const salePayments = allPayments.filter(
    (p) => (p.payment_type === 'RECEIVED' && p.payment_context === 'SALE') || p.payment_type === 'SALE_RECEIVED'
  );
  const allDocs = getDocumentsForProperty(property.p_id);

  const deadlineClass = finances.nextDueDate ? getDeadlineClassification(finances.nextDueDate) : null;

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${property.name}"?\n\nThis property will be marked as DELETED and excluded from your portfolio valuation.`)) {
      deleteProperty(property.p_id);
      onShowToast(`Property "${property.name}" deleted.`, 'info');
      navigate('/real-estate');
    }
  };

  const handleStopRent = () => {
    if (!activeRent) return;
    if (window.confirm(`End current lease with tenant "${activeRent.tenant_name}"?\n\nThe lease history will be preserved in Rent History.`)) {
      stopRent(activeRent.r_id);
      onShowToast(`Tenancy ended. Lease moved to Rent History.`, 'info');
    }
  };

  return (
    <div className="page-container fade-in" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* 1. Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/real-estate')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ChevronLeft size={16} />
          <span>Back to Real Estate</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {property.property_status === 'ACTIVE' && (
            <>
              {!activeRent && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsRentModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <KeyRound size={14} color="#D97706" />
                  <span>Start Rent</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsSellModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Tag size={14} color="#059669" />
                <span>Property Sold</span>
              </button>

              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={handleDelete}
                style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </>
          )}

          {isSold && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/realized-funds')}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <DollarSign size={14} color="#059669" />
              <span>View Realized Funds</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Sold / Deleted Banner if applicable */}
      {isSold && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={18} color="#16A34A" />
            <div>
              <strong style={{ fontSize: '13px', color: '#166534' }}>
                Property Sold
              </strong>
              <div style={{ fontSize: '12px', color: '#15803D' }}>
                ₹ {formatCurrency(finances.totalSaleReceived)} received transferred to Realized Funds.
                {finances.saleReceivableLeft > 0 && ` Remaining receivable: ₹ ${formatCurrency(finances.saleReceivableLeft)}.`}
              </div>
            </div>
          </div>
          {finances.saleReceivableLeft > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setPaymentModalType('SALE_RECEIVED');
                setIsRecordPaymentOpen(true);
              }}
            >
              <Plus size={14} />
              <span>Record Sale Payment</span>
            </button>
          )}
        </div>
      )}

      {isDeleted && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#991B1B'
          }}
        >
          <AlertCircle size={18} />
          <div>
            <strong>Property Marked as Deleted</strong>
            <div style={{ fontSize: '12px' }}>
              This record is preserved in history but excluded from active portfolio totals and charts.
            </div>
          </div>
        </div>
      )}

      {/* 2.5 Active Full Money Pending / Missed Notification Banner */}
      {!isDeleted && (isSold ? finances.saleReceivableLeft > 0 : finances.paymentLeft > 0) && (
        <div
          style={{
            background: finances.paymentStatus === 'missed' ? '#FEF2F2' : '#EFF6FF',
            border: `1px solid ${finances.paymentStatus === 'missed' ? '#FECACA' : '#BFDBFE'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: finances.paymentStatus === 'missed' ? '#FEE2E2' : '#DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: finances.paymentStatus === 'missed' ? '#DC2626' : '#2563EB',
                flexShrink: 0
              }}
            >
              {finances.paymentStatus === 'missed' ? <AlertCircle size={20} /> : <Clock size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: finances.paymentStatus === 'missed' ? '#DC2626' : '#2563EB',
                    color: '#FFFFFF'
                  }}
                >
                  {finances.paymentStatus === 'missed' ? 'Overdue Deadline' : 'Payment Pending'}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: finances.paymentStatus === 'missed' ? '#991B1B' : '#1E40AF'
                  }}
                >
                  {isSold
                    ? `Due Date to Receive Full Money: ₹ ${formatCurrency(finances.saleReceivableLeft)}`
                    : `Due Date to Give Full Money: ₹ ${formatCurrency(finances.paymentLeft)}`}
                </span>
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: finances.paymentStatus === 'missed' ? '#B91C1C' : '#1E3A8A',
                  lineHeight: 1.4
                }}
              >
                {finances.nextDueDate ? (
                  <>
                    Full remaining amount of{' '}
                    <strong>₹ {formatCurrency(isSold ? finances.saleReceivableLeft : finances.paymentLeft)}</strong> is due on{' '}
                    <strong>{formatDate(finances.nextDueDate)}</strong>{' '}
                    {deadlineClass && (
                      <span
                        style={{
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: deadlineClass.bgTint,
                          border: `1px solid ${deadlineClass.borderTint}`,
                          color: deadlineClass.textDark,
                          fontSize: '11px',
                          marginLeft: '4px'
                        }}
                      >
                        {deadlineClass.relativeText}
                      </span>
                    )}
                    .{' '}
                    {isSold
                      ? 'To be received from buyer.'
                      : `To be paid to seller ${property.party_name}.`}
                  </>
                ) : (
                  <>
                    Full remaining balance is <strong>₹ {formatCurrency(isSold ? finances.saleReceivableLeft : finances.paymentLeft)}</strong>. Please set a deadline when recording your next payment.
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setPaymentModalType(isSold ? 'SALE_RECEIVED' : 'PURCHASE');
              setIsRecordPaymentOpen(true);
            }}
            style={{
              flexShrink: 0,
              background: finances.paymentStatus === 'missed' ? '#DC2626' : undefined,
              borderColor: finances.paymentStatus === 'missed' ? '#B91C1C' : undefined
            }}
          >
            <Plus size={14} />
            <span>{isSold ? 'Record Sale Received' : 'Record Purchase Payment'}</span>
          </button>
        </div>
      )}

      {/* 3. Property Overview Card */}
      <div className="card-panel" style={{ padding: '24px 28px', border: '1px solid var(--border-light)', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: typeConfig.bgColor,
                  color: typeConfig.color
                }}
              >
                <span>{typeConfig.icon}</span>
                <span>{typeConfig.label}</span>
              </span>

              {activeRent && !isSold && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: '#FEF3C7',
                    color: '#B45309'
                  }}
                >
                  <KeyRound size={11} />
                  <span>Currently Rented</span>
                </span>
              )}

              {isSold && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: '#F1F5F9',
                    color: '#475569'
                  }}
                >
                  <Tag size={11} />
                  <span>SOLD</span>
                </span>
              )}

              {!isDeleted && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    background:
                      finances.paymentStatus === 'completed'
                        ? '#DCFCE7'
                        : finances.paymentStatus === 'missed'
                        ? '#FEE2E2'
                        : '#EFF6FF',
                    color:
                      finances.paymentStatus === 'completed'
                        ? '#15803D'
                        : finances.paymentStatus === 'missed'
                        ? '#991B1B'
                        : '#1E40AF',
                    border: `1px solid ${
                      finances.paymentStatus === 'completed'
                        ? '#86EFAC'
                        : finances.paymentStatus === 'missed'
                        ? '#FCA5A5'
                        : '#BFDBFE'
                    }`
                  }}
                >
                  {finances.paymentStatus === 'completed' && <CheckCircle2 size={11} />}
                  {finances.paymentStatus === 'missed' && <AlertCircle size={11} />}
                  {finances.paymentStatus === 'pending' && <Clock size={11} />}
                  <span>{isSold ? 'Proceeds ' : 'Payment '}{finances.paymentStatus}</span>
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              {property.name}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} color="var(--color-primary)" />
                <span>{property.location}</span>
              </div>
              {property.area_sqft && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <span>📏</span>
                  <span>{property.area_sqft} Sq.ft</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
              {isSold ? 'Original Purchase Price' : 'Purchase Price'}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              ₹ {formatCurrency(property.purchase_price)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Acquired {formatDate(property.purchase_date)}
            </div>
          </div>
        </div>

        {/* Financial Balance Summary Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            padding: '14px 18px',
            background: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Purchase Payments Made
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#16A34A', marginTop: '2px' }}>
              ₹ {formatCurrency(finances.totalPurchasePaid)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Purchase Payment Remaining
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: finances.paymentLeft > 0 ? '#DC2626' : '#64748B', marginTop: '2px' }}>
              ₹ {formatCurrency(finances.paymentLeft)}
            </div>
          </div>

          {isSold && (
            <>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Sale Amount Realized
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#16A34A', marginTop: '2px' }}>
                  ₹ {formatCurrency(finances.totalSaleReceived)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Sale Receivable Due
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: finances.saleReceivableLeft > 0 ? '#DC2626' : '#64748B', marginTop: '2px' }}>
                  ₹ {formatCurrency(finances.saleReceivableLeft)}
                </div>
              </div>
            </>
          )}

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {isSold ? 'Receivable Due Date' : 'Payment Deadline (To Seller)'}
            </div>
            <div style={{ marginTop: '3px' }}>
              {deadlineClass && (isSold ? finances.saleReceivableLeft : finances.paymentLeft) > 0 ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: deadlineClass.bgTint,
                    border: `1px solid ${deadlineClass.borderTint}`,
                    color: deadlineClass.textDark
                  }}
                >
                  {deadlineClass.isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                  <span>{deadlineClass.relativeText}</span>
                  <span style={{ opacity: 0.8 }}>({formatDate(finances.nextDueDate!)})</span>
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle2 size={12} />
                  <span>{isSold ? 'Fully Received' : 'Fully Paid'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Seller Info & Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', fontSize: '13px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Purchased from (Seller): </span>
            <strong style={{ color: 'var(--text-primary)' }}>{property.party_name}</strong>
            {property.party_contact && (
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px' }}>
                Contact: {property.party_contact}
              </span>
            )}
          </div>

          {property.p_notes && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Notes: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{property.p_notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Active Tenant Section (if currently rented) */}
      {activeRent && (
        <div
          className="card-panel"
          style={{
            padding: '22px 24px',
            border: '1px solid #FDE68A',
            background: '#FEFDF8',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '22px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} color="#D97706" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#92400E' }}>
                Active Tenancy
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleStopRent}
              style={{ fontSize: '12px', color: '#DC2626' }}
            >
              End Current Tenancy
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Tenant Name</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {activeRent.tenant_name}
              </div>
              {activeRent.tenant_contact && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {activeRent.tenant_contact}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Monthly Rent</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#B45309', marginTop: '2px' }}>
                ₹ {formatCurrency(activeRent.rent_amount)}
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}> / month</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Lease Period</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                {formatDate(activeRent.rent_start_date)}
                {activeRent.rent_end_date && ` to ${formatDate(activeRent.rent_end_date)}`}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Next Rent Due Date</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {formatDate(activeRent.next_rent_due)}
              </div>
            </div>
          </div>

          {activeRent.r_notes && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#92400E', background: '#FEF3C7', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              <strong>Rent Notes:</strong> {activeRent.r_notes}
            </div>
          )}
        </div>
      )}

      {/* 5. Purchase Payments Tracking */}
      <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Purchase Payments Tracker
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Track payments made to the seller. Remaining balance calculates automatically.
            </p>
          </div>
          {property.property_status === 'ACTIVE' && finances.paymentLeft > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setPaymentModalType('PURCHASE');
                setIsRecordPaymentOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} />
              <span>Record Purchase Payment</span>
            </button>
          )}
        </div>

        {purchasePayments.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '13px' }}>
            No purchase payment records logged. Click "Record Purchase Payment" to add payments made.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Amount</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Payment Date</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Due Date</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {purchasePayments.map((pay) => {
                  const payDeadline = pay.due_date ? getDeadlineClassification(pay.due_date) : null;
                  return (
                    <tr key={pay.payment_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <strong style={{ fontSize: '14px', color: '#16A34A' }}>
                          ₹ {formatCurrency(pay.amount)}
                        </strong>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {formatDate(pay.payment_date)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {payDeadline ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              background: payDeadline.bgTint,
                              border: `1px solid ${payDeadline.borderTint}`,
                              color: payDeadline.textDark
                            }}
                          >
                            <span>{payDeadline.relativeText}</span>
                          </span>
                        ) : pay.due_date ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(pay.due_date)}</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: pay.status === 'PAID' ? '#DCFCE7' : pay.status === 'OVERDUE' ? '#FEE2E2' : '#FEF3C7',
                            color: pay.status === 'PAID' ? '#15803D' : pay.status === 'OVERDUE' ? '#991B1B' : '#B45309'
                          }}
                        >
                          {pay.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {pay.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Sale Payments Tracking (if property is SOLD) */}
      {isSold && (
        <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Sale Payments (Realized Funds)
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Payments received from buyer. Only received money is added to Realized Funds.
              </p>
            </div>
            {finances.saleReceivableLeft > 0 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setPaymentModalType('SALE_RECEIVED');
                  setIsRecordPaymentOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} />
                <span>Record Sale Payment</span>
              </button>
            )}
          </div>

          {salePayments.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '13px' }}>
              No sale payment records logged yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Amount</th>
                    <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Received Date</th>
                    <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Due Date</th>
                    <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {salePayments.map((pay) => (
                    <tr key={pay.payment_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <strong style={{ fontSize: '14px', color: '#16A34A' }}>
                          ₹ {formatCurrency(pay.amount)}
                        </strong>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {formatDate(pay.payment_date)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {pay.due_date ? formatDate(pay.due_date) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: pay.status === 'RECEIVED' ? '#DCFCE7' : '#FEF3C7',
                            color: pay.status === 'RECEIVED' ? '#15803D' : '#B45309'
                          }}
                        >
                          {pay.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {pay.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 7. Rent History */}
      <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Rent History
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Historical tenant and lease records across the property's lifetime
            </p>
          </div>
          {property.property_status === 'ACTIVE' && !activeRent && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsRentModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} />
              <span>Start Rent</span>
            </button>
          )}
        </div>

        {allRents.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '13px' }}>
            No rental records logged for this property.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {allRents.map((r) => (
              <div
                key={r.r_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: r.is_active ? '#FEFDF8' : 'var(--bg-surface-subtle)',
                  border: r.is_active ? '1px solid #FDE68A' : '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {r.tenant_name}
                    </strong>
                    {r.is_active ? (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                        CURRENT
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#F1F5F9', color: '#64748B', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                        PAST
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Period: {formatDate(r.rent_start_date)} {r.rent_end_date ? `to ${formatDate(r.rent_end_date)}` : ''}
                    {r.tenant_contact && ` • ${r.tenant_contact}`}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#B45309' }}>
                    ₹ {formatCurrency(r.rent_amount)} / mo
                  </div>
                  {r.r_notes && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {r.r_notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8. Documents Vault */}
      <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Document Vault
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Deeds, agreements, receipts, and tax records
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsAddDocModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} />
            <span>Attach Document</span>
          </button>
        </div>

        {allDocs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '13px' }}>
            No documents attached yet. Click "Attach Document" to store property files.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {allDocs.map((doc) => (
              <div
                key={doc.d_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <FileText size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={doc.d_name}
                    >
                      {doc.d_name}
                    </div>
                    {doc.r_id && (
                      <span style={{ fontSize: '10px', color: '#B45309', fontWeight: 600 }}>
                        Rent Document
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {doc.d_link && doc.d_link !== 'Uploaded Document' && (
                    <button
                      type="button"
                      className="btn btn-subtle btn-sm"
                      onClick={() => {
                        if (doc.d_link.startsWith('data:image')) {
                          setSelectedPhotoUrl(doc.d_link);
                        } else {
                          window.open(doc.d_link, '_blank');
                        }
                      }}
                      style={{ padding: '4px' }}
                      title="View / Open Document"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-subtle btn-sm"
                    onClick={() => {
                      if (window.confirm(`Delete document "${doc.d_name}"?`)) {
                        removeDocument(doc.d_id);
                        onShowToast(`Document removed`, 'info');
                      }
                    }}
                    style={{ color: '#DC2626', padding: '4px' }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <StartRentModal
        isOpen={isRentModalOpen}
        onClose={() => setIsRentModalOpen(false)}
        property={property}
        onStartRent={(rentData) => {
          startRent(property.p_id, rentData, rentData.documents);
          onShowToast(`Property rented to ${rentData.tenant_name}`, 'success');
        }}
      />

      <SellPropertyModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        property={property}
        onConfirmSale={(saleData) => {
          sellProperty(property.p_id, saleData);
          onShowToast(`Property marked as SOLD. ₹ ${formatCurrency(saleData.amount_received)} transferred to Realized Funds.`, 'success');
        }}
      />

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
            onShowToast(`Purchase payment of ₹ ${formatCurrency(payload.amount)} recorded`, 'success');
          } else {
            recordSalePayment(property.p_id, payload);
            onShowToast(`Sale payment of ₹ ${formatCurrency(payload.amount)} received & added to Realized Funds`, 'success');
          }
        }}
      />

      <AddDocumentModal
        isOpen={isAddDocModalOpen}
        onClose={() => setIsAddDocModalOpen(false)}
        propertyName={property.name}
        onAddDocument={async (doc) => {
          await addDocument(property.p_id, doc);
          onShowToast(`Document "${doc.d_name}" saved to database`, 'success');
        }}
      />

      <PhotoModal
        photoUrl={selectedPhotoUrl}
        onClose={() => setSelectedPhotoUrl(null)}
      />
    </div>
  );
};
