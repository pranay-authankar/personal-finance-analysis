import React, { useState } from 'react';
import { useInvestments } from '../context/InvestmentContext';
import type { RealizedReason, RealizedSourceCategory } from '../types';
import { formatCurrency } from '../utils/calculations';
import { X, CheckCircle2, Wallet, Info } from 'lucide-react';

interface RealizeAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetCategory: RealizedSourceCategory;
  assetId: string;
  assetName: string;
  suggestedAmount: number;
  defaultReason?: RealizedReason;
  onSuccess: (amount: number, reason: string) => void;
}

export const RealizeAssetModal: React.FC<RealizeAssetModalProps> = ({
  isOpen,
  onClose,
  assetCategory,
  assetId,
  assetName,
  suggestedAmount,
  defaultReason = 'Matured',
  onSuccess
}) => {
  const { realizeInvestment } = useInvestments();

  const [amount, setAmount] = useState<string>(suggestedAmount ? String(suggestedAmount) : '');
  const [reason, setReason] = useState<RealizedReason>(defaultReason);
  const [dateReceived, setDateReceived] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount received in ₹');
      return;
    }

    realizeInvestment({
      sourceCategory: assetCategory,
      sourceId: assetId,
      amount: numAmount,
      dateReceived,
      reason,
      remarks: remarks.trim()
    });

    onSuccess(numAmount, reason);
    onClose();
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', padding: '28px 30px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#F0FDFA',
                border: '1px solid #CCFBF1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0D9488'
              }}
            >
              <Wallet size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Move to Realized Funds
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {assetName}
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

        {/* Explanation callout */}
        <div
          style={{
            background: '#F0FDFA',
            border: '1px solid #99F6E4',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#115E59'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Info size={16} color="#0D9488" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Moving this asset will mark it as <strong>{reason}</strong> (its active investment value becomes ₹0) and transfer <strong>₹ {formatCurrency(Number(amount) || 0)}</strong> to <strong>Realized Funds</strong>.
              <br />
              <strong>No double-counting:</strong> Your family’s total tracked wealth remains intact!
            </div>
          </div>
        </div>

        <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">
              Amount Received (₹) <span style={{ color: 'var(--color-crimson)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--text-muted)'
                }}
              >
                ₹
              </span>
              <input
                type="number"
                className={`input-field ${error ? 'input-error' : ''}`}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                style={{ paddingLeft: '28px', fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-family-mono)' }}
                min="0"
                step="any"
              />
            </div>
            {error && <span className="field-error-msg">{error}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Status / Reason</label>
              <select
                className="input-field"
                value={reason}
                onChange={(e) => setReason(e.target.value as RealizedReason)}
                style={{ fontWeight: 600 }}
              >
                <option value="Matured">Matured</option>
                <option value="Sold">Sold</option>
                <option value="Redeemed">Redeemed</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Date Received</label>
              <input
                type="date"
                className="input-field"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Remarks <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Transferred to savings account"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#0D9488', borderColor: '#0F766E' }}
            >
              <CheckCircle2 size={16} />
              <span>Confirm &amp; Move Funds</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
