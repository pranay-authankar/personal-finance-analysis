import React, { useState } from 'react';
import type { PropertyRecord, PaymentStatus } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getLocalDateString } from '../utils/dateUtils';
import { X, Tag, AlertCircle, Check, Plus, Trash2, FileText, CheckCircle2, Clock, Upload, Loader2 } from 'lucide-react';
import { uploadDocumentFile } from '../utils/fileUpload';

interface SaleDocInput {
  d_name: string;
  d_link: string;
}

interface SellPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyRecord;
  onConfirmSale: (saleData: {
    buyer_name: string;
    sale_price: number;
    sale_date: string;
    due_date?: string;
    amount_received: number;
    payment_status: PaymentStatus;
    notes?: string;
    documents?: SaleDocInput[];
  }) => void;
}

export const SellPropertyModal: React.FC<SellPropertyModalProps> = ({
  isOpen,
  onClose,
  property,
  onConfirmSale
}) => {
  const [buyerName, setBuyerName] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>(
    property.purchase_price ? String(property.purchase_price) : ''
  );
  const [saleDate, setSaleDate] = useState<string>(
    getLocalDateString()
  );
  const [dueDate, setDueDate] = useState<string>('');
  const [amountReceived, setAmountReceived] = useState<string>(
    property.purchase_price ? String(property.purchase_price) : ''
  );
  const [notes, setNotes] = useState<string>('');
  const [documents, setDocuments] = useState<SaleDocInput[]>([]);
  const [docTypePreset, setDocTypePreset] = useState<string>('Sale Deed / Registry');
  const [customDocName, setCustomDocName] = useState<string>('');
  const [docFileUrl, setDocFileUrl] = useState<string>('');
  const [docFileName, setDocFileName] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const numSalePrice = Number(salePrice) || 0;
  const numReceived = Number(amountReceived) || 0;
  const remainingReceivable = Math.max(0, numSalePrice - numReceived);
  const isFullPayment = numSalePrice > 0 && remainingReceivable === 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError('Document exceeds 8MB limit');
        return;
      }
      setDocFileName(file.name);
      setIsUploadingDoc(true);
      setError('');
      try {
        const uploadedUrl = await uploadDocumentFile(file);
        setDocFileUrl(uploadedUrl);
      } catch {
        setError('Failed to upload document file');
      } finally {
        setIsUploadingDoc(false);
      }
    }
  };

  const handleAddDoc = () => {
    if (isUploadingDoc) {
      setError('Please wait for the document file to finish uploading');
      return;
    }
    const title = docTypePreset === 'Other Document' ? customDocName.trim() : docTypePreset.trim();
    if (!title) {
      setError('Please provide a document name');
      return;
    }
    if (!docFileUrl && !docFileName) {
      setError('Please select a file to upload');
      return;
    }
    setDocuments([
      ...documents,
      {
        d_name: title,
        d_link: docFileUrl || `/uploads/${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      }
    ]);
    setDocTypePreset('Sale Deed / Registry');
    setCustomDocName('');
    setDocFileUrl('');
    setDocFileName('');
    setError('');
  };

  const handleRemoveDoc = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!buyerName.trim()) {
      setError('Please provide buyer / party name');
      return;
    }
    if (!salePrice || isNaN(numSalePrice) || numSalePrice <= 0) {
      setError('Please enter a valid sale price in ₹');
      return;
    }
    if (isNaN(numReceived) || numReceived < 0) {
      setError('Amount received cannot be negative');
      return;
    }
    if (numReceived > numSalePrice) {
      setError('Amount received cannot exceed the total sale price');
      return;
    }

    if (remainingReceivable > 0 && !dueDate) {
      setError(`Please specify the due date to receive the remaining full money of ₹ ${formatCurrency(remainingReceivable)}`);
      return;
    }

    if (isUploadingDoc) {
      setError('Please wait for the document file to finish uploading');
      return;
    }

    // Auto-include any document currently in the upload box
    const finalDocs = [...documents];
    if (docFileUrl || docFileName) {
      const pendingTitle = docTypePreset === 'Other Document' ? customDocName.trim() : docTypePreset.trim();
      if (!pendingTitle) {
        setError('Please specify the document name for the uploaded document');
        return;
      }
      finalDocs.push({
        d_name: pendingTitle,
        d_link: docFileUrl || `/uploads/${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      });
    }

    onConfirmSale({
      buyer_name: buyerName.trim(),
      sale_price: numSalePrice,
      sale_date: saleDate,
      due_date: remainingReceivable > 0 ? dueDate : undefined,
      amount_received: numReceived,
      payment_status: isFullPayment ? 'RECEIVED' : 'PENDING',
      notes: notes.trim() || undefined,
      documents: finalDocs.length > 0 ? finalDocs : undefined
    });

    onClose();
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569'
              }}
            >
              <Tag size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Mark Property as Sold
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {property.name}
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

        {/* Auto-detected status pill */}
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
            <span>Automatic Status: {isFullPayment ? 'COMPLETED (Full Money Received)' : 'PENDING (Receivable Due)'}</span>
          </div>
          <div style={{ marginTop: '2px' }}>
            {isFullPayment
              ? `All ₹ ${formatCurrency(numSalePrice)} received transferred to Realized Funds.`
              : `₹ ${formatCurrency(numReceived)} transferred to Realized Funds. Remaining balance of ₹ ${formatCurrency(remainingReceivable)} tracked as PENDING.`}
          </div>
        </div>

        {error && (
          <div className="alert-danger" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Buyer Name */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Buyer / Party Name *
            </label>
            <input
              type="text"
              className="form-input"
              value={buyerName}
              onChange={(e) => {
                setBuyerName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Rajesh Kumar"
              required
              autoFocus
            />
          </div>

          {/* Sale Price & Sale Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Total Agreed Sale Price (₹) *
              </label>
              <input
                type="number"
                className="form-input"
                value={salePrice}
                onChange={(e) => {
                  setSalePrice(e.target.value);
                  setError('');
                }}
                placeholder="e.g. 5000000"
                required
                min="1"
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Sale Date *
              </label>
              <input
                type="date"
                className="form-input"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Amount Received Now */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                Amount Received Upfront / Now (₹) *
              </label>
              {numSalePrice > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountReceived(String(numSalePrice))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Received 100% upfront
                </button>
              )}
            </div>
            <input
              type="number"
              className="form-input"
              value={amountReceived}
              onChange={(e) => {
                setAmountReceived(e.target.value);
                setError('');
              }}
              placeholder="e.g. 2000000"
              required
              min="0"
              max={numSalePrice || undefined}
            />
            {numReceived > 0 && (
              <span style={{ fontSize: '11px', color: '#16A34A', display: 'block', marginTop: '2px', fontWeight: 600 }}>
                Transfers ₹ {formatCurrency(numReceived)} to Realized Funds
              </span>
            )}
          </div>

          {/* Due Date to Receive Full Money (if pending) */}
          {remainingReceivable > 0 && (
            <div
              style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px'
              }}
            >
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF', marginBottom: '6px' }}>
                Due Date to Receive Full Money (₹ {formatCurrency(remainingReceivable)}) *
              </label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setError('');
                }}
                min={saleDate}
                required
              />
              <span style={{ fontSize: '11px', color: '#1E40AF', display: 'block', marginTop: '4px' }}>
                {dueDate ? `You will be notified before ${formatDate(dueDate)}` : 'Enter the agreed deadline to receive the full remaining money.'}
              </span>
            </div>
          )}

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
              placeholder="e.g. Token advance paid via cheque, balance due at registry"
            />
          </div>

          {/* Sale-related documents */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Sale Documents (Optional)
            </label>
            
            {documents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {documents.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: 'var(--bg-surface-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={13} color="var(--color-primary)" />
                      <span style={{ fontWeight: 600 }}>{doc.d_name}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-subtle btn-sm"
                      onClick={() => handleRemoveDoc(idx)}
                      style={{ padding: '2px', color: '#DC2626' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: 'var(--bg-surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: docTypePreset === 'Other Document' ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Document Type
                  </label>
                  <select
                    className="form-input"
                    value={docTypePreset}
                    onChange={(e) => {
                      setDocTypePreset(e.target.value);
                      setError('');
                    }}
                  >
                    <option value="Sale Deed / Registry">Sale Deed / Registry</option>
                    <option value="Agreement to Sell">Agreement to Sell</option>
                    <option value="Full Payment Receipt / NOC">Full Payment Receipt / NOC</option>
                    <option value="Possession Handover Letter">Possession Handover Letter</option>
                    <option value="Buyer ID Proof">Buyer ID Proof</option>
                    <option value="Other Document">Other Document</option>
                  </select>
                </div>

                {docTypePreset === 'Other Document' && (
                  <div>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                      Document Name *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={customDocName}
                      onChange={(e) => {
                        setCustomDocName(e.target.value);
                        setError('');
                      }}
                      placeholder="Enter document name"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Upload Dropzone */}
              <div
                style={{
                  border: '2px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  textAlign: 'center',
                  background: 'var(--bg-surface)',
                  cursor: isUploadingDoc ? 'not-allowed' : 'pointer',
                  marginBottom: '10px'
                }}
                onClick={() => {
                  if (!isUploadingDoc) {
                    document.getElementById('sale-doc-upload-input')?.click();
                  }
                }}
              >
                <input
                  id="sale-doc-upload-input"
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                  disabled={isUploadingDoc}
                />
                {isUploadingDoc ? (
                  <Loader2 size={20} className="spin" style={{ margin: '0 auto 4px', color: 'var(--color-primary)' }} />
                ) : (
                  <Upload size={20} style={{ margin: '0 auto 4px', color: 'var(--color-primary)' }} />
                )}
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isUploadingDoc ? (
                    <span>Uploading file...</span>
                  ) : docFileName ? (
                    <span style={{ color: '#16A34A' }}>✓ Selected: {docFileName}</span>
                  ) : (
                    'Click to select PDF, PNG, JPG, or WebP'
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddDoc}
                  disabled={isUploadingDoc}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} />
                  <span>Attach Another Doc</span>
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Auto-saved upon submitting
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              <span>Confirm Property Sold</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
