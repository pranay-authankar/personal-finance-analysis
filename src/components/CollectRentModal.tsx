import React, { useState } from 'react';
import type { PropertyRecord, RentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getLocalDateString, parseLocalDate } from '../utils/dateUtils';
import { X, Wallet, Calendar, AlertCircle, Check, ArrowRight } from 'lucide-react';

interface CollectRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyRecord;
  activeRent: RentRecord;
  onRecordPayment: (payload: {
    amount: number;
    payment_date: string;
    next_rent_due?: string;
    notes?: string;
    r_id?: string;
  }) => Promise<void>;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const CollectRentModal: React.FC<CollectRentModalProps> = ({
  isOpen,
  onClose,
  property,
  activeRent,
  onRecordPayment,
  onShowToast
}) => {
  const [amount, setAmount] = useState<string>(() => String(activeRent.rent_amount || ''));
  const [paymentDate, setPaymentDate] = useState<string>(() => getLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [notes, setNotes] = useState<string>('');
  const [nextDueDate, setNextDueDate] = useState<string>(() => {
    if (activeRent.next_rent_due) {
      const parsed = parseLocalDate(activeRent.next_rent_due);
      if (parsed) {
        parsed.setMonth(parsed.getMonth() + 1);
        return getLocalDateString(parsed);
      }
    }
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return getLocalDateString(d);
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const isOverdue = Boolean(activeRent.next_rent_due && activeRent.next_rent_due < getLocalDateString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid payment amount in ₹');
      return;
    }

    if (!paymentDate) {
      setError('Please provide the payment collection date');
      return;
    }

    setIsSubmitting(true);
    try {
      const combinedNotes = [
        paymentMethod ? `Paid via ${paymentMethod}` : '',
        notes.trim()
      ]
        .filter(Boolean)
        .join(' • ');

      await onRecordPayment({
        amount: numAmount,
        payment_date: paymentDate,
        next_rent_due: nextDueDate || undefined,
        notes: combinedNotes || `Monthly rent from ${activeRent.tenant_name}`,
        r_id: activeRent.r_id
      });

      if (onShowToast) {
        onShowToast(`Rent payment of ₹ ${formatCurrency(numAmount)} recorded for ${activeRent.tenant_name}!`, 'success');
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to collect rent:', err);
      setError(err?.message || 'Failed to record rent collection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay bullion-modal-overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content-box bullion-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px' }}
      >
        {/* Header */}
        <div className="bullion-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="bullion-modal-icon-badge" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A' }}>
              <Wallet size={18} />
            </div>
            <div>
              <h2 className="bullion-modal-title">Collect Rent Payment</h2>
              <span className="bullion-modal-sub">
                {property.name} • Tenant: {activeRent.tenant_name}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="bullion-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bullion-modal-body">
          {error && (
            <div className="bullion-modal-error-box" style={{ marginBottom: '16px' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Current Due Date Alert */}
          {activeRent.next_rent_due && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                background: isOverdue ? 'rgba(239, 68, 68, 0.08)' : 'rgba(22, 163, 74, 0.08)',
                border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.25)' : 'rgba(22, 163, 74, 0.25)'}`,
                marginBottom: '16px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={15} color={isOverdue ? '#DC2626' : '#16A34A'} />
                <span style={{ fontWeight: 600, color: isOverdue ? '#991B1B' : '#15803D' }}>
                  {isOverdue ? 'Overdue Due Date' : 'Current Due Date'}:
                </span>
                <span style={{ color: 'var(--color-navy)', fontWeight: 700 }}>
                  {formatDate(activeRent.next_rent_due)}
                </span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: isOverdue ? '#DC2626' : '#16A34A' }}>
                {isOverdue ? 'Overdue' : 'On Schedule'}
              </span>
            </div>
          )}

          {/* Amount Received */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="collectRentAmount">
              Amount Received (₹) <span className="text-required">*</span>
            </label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--color-charcoal-muted)'
                }}
              >
                ₹
              </span>
              <input
                id="collectRentAmount"
                type="number"
                min="1"
                step="any"
                className="form-input"
                style={{ paddingLeft: '28px', fontSize: '16px', fontWeight: 700 }}
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={() => setAmount(String(activeRent.rent_amount))}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                1 Month: ₹ {formatCurrency(Number(activeRent.rent_amount))}
              </button>
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={() => setAmount(String(Number(activeRent.rent_amount) * 2))}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                2 Months: ₹ {formatCurrency(Number(activeRent.rent_amount) * 2)}
              </button>
            </div>
          </div>

          {/* Collection Date & Payment Mode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="collectPaymentDate">
                Collection Date <span className="text-required">*</span>
              </label>
              <input
                id="collectPaymentDate"
                type="date"
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="collectPaymentMethod">
                Payment Method
              </label>
              <select
                id="collectPaymentMethod"
                className="form-input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other Mode</option>
              </select>
            </div>
          </div>

          {/* Next Due Date Update */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="collectNextDueDate" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>New Next Due Date</span>
              <ArrowRight size={13} color="var(--color-charcoal-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-charcoal-muted)' }}>
                (Automatically advances schedule)
              </span>
            </label>
            <input
              id="collectNextDueDate"
              type="date"
              className="form-input"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </div>

          {/* Notes / Reference */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="collectRentNotes">
              Transaction Notes / Reference <span className="text-optional">(Optional)</span>
            </label>
            <input
              id="collectRentNotes"
              type="text"
              className="form-input"
              placeholder="e.g. UTR #12345678, Received via WhatsApp confirmation"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Modal Actions */}
          <div className="bullion-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ background: '#16A34A', borderColor: '#16A34A', minWidth: '160px' }}
            >
              {isSubmitting ? 'Recording...' : (
                <>
                  <Check size={15} style={{ marginRight: '6px' }} />
                  Record Collection
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
