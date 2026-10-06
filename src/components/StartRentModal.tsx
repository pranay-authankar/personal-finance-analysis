import React, { useState } from 'react';
import type { PropertyRecord } from '../types';
import { formatCurrency } from '../utils/calculations';
import { X, KeyRound, AlertCircle, Info, Check, Plus, Trash2, FileText, Upload, Loader2 } from 'lucide-react';
import { uploadDocumentFile } from '../utils/fileUpload';

interface RentDocInput {
  d_name: string;
  d_link: string;
}

interface StartRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyRecord;
  onStartRent: (payload: {
    tenant_name: string;
    tenant_contact: string;
    rent_amount: number;
    rent_start_date: string;
    rent_end_date?: string;
    next_rent_due: string;
    r_notes?: string;
    documents?: { d_name: string; d_link: string }[];
  }) => void;
}

export const StartRentModal: React.FC<StartRentModalProps> = ({
  isOpen,
  onClose,
  property,
  onStartRent
}) => {
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantContact, setTenantContact] = useState<string>('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [nextRentDueDate, setNextRentDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>('');
  const [documents, setDocuments] = useState<RentDocInput[]>([]);
  const [docTypePreset, setDocTypePreset] = useState<string>('Rent Agreement');
  const [customDocName, setCustomDocName] = useState<string>('');
  const [docFileUrl, setDocFileUrl] = useState<string>('');
  const [docFileName, setDocFileName] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

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
    setDocTypePreset('Rent Agreement');
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
    const rentNum = Number(rentAmount);
    if (!tenantName.trim()) {
      setError('Please provide tenant name');
      return;
    }
    if (!rentAmount || isNaN(rentNum) || rentNum <= 0) {
      setError('Please enter a valid monthly rent amount in ₹');
      return;
    }
    if (!nextRentDueDate) {
      setError('Please specify the next expected rent due date');
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

    onStartRent({
      tenant_name: tenantName.trim(),
      tenant_contact: tenantContact.trim(),
      rent_amount: rentNum,
      rent_start_date: startDate,
      rent_end_date: endDate || undefined,
      next_rent_due: nextRentDueDate,
      r_notes: notes.trim() || undefined,
      documents: finalDocs.length > 0 ? finalDocs : undefined
    });

    onClose();
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D97706'
              }}
            >
              <KeyRound size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Start Renting Property
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

        {/* Note on rental income */}
        <div
          style={{
            background: '#FEF3C7',
            border: '1px solid #FDE68A',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#92400E',
            lineHeight: 1.4
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 600 }}>
            <Info size={14} />
            <span>Rental Income Isolation</span>
          </div>
          <div style={{ marginTop: '2px' }}>
            Rental income goes directly to your bank account and is NOT added to the Real Estate investment capital.
          </div>
        </div>

        {error && (
          <div className="alert-danger" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Tenant Name & Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Tenant Name *
              </label>
              <input
                type="text"
                className="form-input"
                value={tenantName}
                onChange={(e) => {
                  setTenantName(e.target.value);
                  setError('');
                }}
                placeholder="e.g. Ramesh Verma"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Tenant Contact
              </label>
              <input
                type="text"
                className="form-input"
                value={tenantContact}
                onChange={(e) => setTenantContact(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {/* Monthly Rent */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Monthly Rent Amount (₹) *
            </label>
            <input
              type="number"
              className="form-input"
              value={rentAmount}
              onChange={(e) => {
                setRentAmount(e.target.value);
                setError('');
              }}
              placeholder="e.g. 35000"
              required
              min="1"
            />
            {Number(rentAmount) > 0 && (
              <span style={{ fontSize: '11px', color: '#B45309', display: 'block', marginTop: '3px', fontWeight: 600 }}>
                ₹ {formatCurrency(Number(rentAmount))} / month
              </span>
            )}
          </div>

          {/* Start Date & End Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Rent Start Date *
              </label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Rent End Date
              </label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Next Rent Due Date */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Next Rent Due Date *
            </label>
            <input
              type="date"
              className="form-input"
              value={nextRentDueDate}
              onChange={(e) => setNextRentDueDate(e.target.value)}
              required
            />
          </div>

          {/* Rent Notes */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Rent Notes
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2 months security deposit held, annual 5% escalation"
            />
          </div>

          {/* Rent Documents */}
          <div>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Rent-Related Documents (Optional)
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
                    <option value="Rent Agreement">Rent Agreement</option>
                    <option value="Police Verification Certificate">Police Verification Certificate</option>
                    <option value="Tenant ID Proof / Aadhaar">Tenant ID Proof / Aadhaar</option>
                    <option value="Security Deposit Receipt">Security Deposit Receipt</option>
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
                    document.getElementById('rent-doc-upload-input')?.click();
                  }
                }}
              >
                <input
                  id="rent-doc-upload-input"
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
              <span>Start Renting</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
