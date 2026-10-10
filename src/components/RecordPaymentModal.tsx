import React, { useState } from 'react';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getLocalDateString } from '../utils/dateUtils';
import { X, Wallet, Check, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyName: string;
  type: 'PURCHASE' | 'SALE_RECEIVED';
  maxRemaining?: number;
  fullPaymentDeadline?: string;
  onRecord: (payload: {
    amount: number;
    payment_date: string;
    notes?: string;
  }) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  propertyName,
  type,
  maxRemaining = 0,
  fullPaymentDeadline,
  onRecord
}) => {
  const isSale = type === 'SALE_RECEIVED';

  const [amount, setAmount] = useState<string>(
    maxRemaining > 0 ? String(maxRemaining) : ''
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    getLocalDateString()
  );
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const balanceAfterThisPayment = Math.max(0, maxRemaining - numAmount);
  const isFullPayment = numAmount >= maxRemaining && maxRemaining > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid payment amount in ₹');
      return;
    }

    if (numAmount > maxRemaining && maxRemaining > 0) {
      setError(`Amount cannot exceed remaining balance of ₹ ${formatCurrency(maxRemaining)}`);
      return;
    }

    onRecord({
      amount: numAmount,
      payment_date: paymentDate,
      notes: notes.trim() || undefined
    });

    onClose();
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', padding: '24px 28px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: isSale ? '#F0FDFA' : '#EFF6FF',
                border: `1px solid ${isSale ? '#99F6E4' : '#BFDBFE'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSale ? '#0D9488' : '#2563EB'
              }}
            >
              <Wallet size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isSale ? 'Record Sale Payment Received' : 'Record Purchase Payment'}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {propertyName}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={onClose}
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Auto-decision banner */}
        <div
          style={{
            background: isFullPayment ? '#DCFCE7' : '#FEF3C7',
            border: `1px solid ${isFullPayment ? '#86EFAC' : '#FDE68A'}`,
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: isFullPayment ? '#15803D' : '#92400E',
            lineHeight: 1.4
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700 }}>
            {isFullPayment ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            <span>Automatic Status: {isFullPayment ? 'COMPLETED' : 'PENDING'}</span>
          </div>
          <div style={{ marginTop: '2px' }}>
            {isFullPayment ? (
              `Full payment completed! Status will be marked as COMPLETED and the payment due date will be cleared.`
            ) : (
              <>
                Partial payment. Remaining ₹ {formatCurrency(balanceAfterThisPayment)} will stay PENDING.
                {fullPaymentDeadline && (
                  <span style={{ display: 'block', marginTop: '2px', fontWeight: 600 }}>
                    Full payment deadline: {formatDate(fullPaymentDeadline)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="alert-danger" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Amount Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                {isSale ? 'Amount Received Now (₹) *' : 'Amount Paid Now (₹) *'}
              </label>
              {maxRemaining > 0 && numAmount !== maxRemaining && (
                <button
                  type="button"
                  onClick={() => setAmount(String(maxRemaining))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Pay full remaining (₹ {formatCurrency(maxRemaining)})
                </button>
              )}
            </div>
            <input
              type="number"
              className="form-input"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="e.g. 500000"
              required
              min="1"
              max={maxRemaining || undefined}
              autoFocus
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
              Current Remaining Balance: ₹ {formatCurrency(maxRemaining)}
            </span>
          </div>

          {/* Payment Date */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Payment Date *
            </label>
            <input
              type="date"
              className="form-input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Notes (Optional)
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Bank transfer RTGS ref #1234, token advance, etc."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              <span>{isSale ? 'Save & Transfer to Realized Funds' : 'Record Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
