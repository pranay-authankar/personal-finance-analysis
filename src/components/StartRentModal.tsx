import React, { useState } from 'react';
import type { PropertyRecord } from '../types';
import { getLocalDateString } from '../utils/dateUtils';
import { X, KeyRound, AlertCircle, Check, Plus, Trash2, FileText, Upload, Loader2, Building } from 'lucide-react';
import { uploadDocumentFile } from '../utils/fileUpload';

interface RentDocInput {
  d_name: string;
  d_link: string;
}

interface StartRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  property?: PropertyRecord | null;
  properties?: PropertyRecord[];
  onStartRent: (payload: {
    tenant_name: string;
    tenant_contact: string;
    rent_amount: number;
    rent_start_date: string;
    rent_end_date?: string;
    p_id?: string;
    documents?: { d_name: string; d_link: string }[];
  }) => void | Promise<void>;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const StartRentModal: React.FC<StartRentModalProps> = ({
  isOpen,
  onClose,
  property,
  properties = [],
  onStartRent,
  onShowToast
}) => {
  // Available active properties
  const activePropertyList = properties.length > 0
    ? properties
    : (property ? [property] : []);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(() => {
    return property?.p_id || (activePropertyList[0]?.p_id || '');
  });

  const [tenantName, setTenantName] = useState<string>('');
  const [tenantContact, setTenantContact] = useState<string>('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getLocalDateString());
  const [endDate, setEndDate] = useState<string>('');

  const [documents, setDocuments] = useState<RentDocInput[]>([]);
  const [docTypePreset, setDocTypePreset] = useState<string>('Rent Agreement');
  const [customDocName, setCustomDocName] = useState<string>('');
  const [docFileUrl, setDocFileUrl] = useState<string>('');
  const [docFileName, setDocFileName] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const currentSelectedProp = activePropertyList.find((p) => p.p_id === selectedPropertyId) || property;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetPid = selectedPropertyId || property?.p_id;
    if (!targetPid) {
      setError('Please select a property for this rental');
      return;
    }

    const trimmedTenant = tenantName.trim();
    if (!trimmedTenant) {
      setError('Please provide tenant name');
      return;
    }

    const rentNum = Number(rentAmount);
    if (!rentAmount || isNaN(rentNum) || rentNum <= 0) {
      setError('Please enter a valid monthly rent amount in ₹');
      return;
    }

    if (!startDate) {
      setError('Please provide the rent start date');
      return;
    }

    if (isUploadingDoc) {
      setError('Please wait for the document file to finish uploading');
      return;
    }

    // Auto-include any document currently staged in the upload inputs
    const finalDocs = [...documents];
    if (docFileUrl || docFileName) {
      const pendingTitle = docTypePreset === 'Other Document' ? customDocName.trim() : docTypePreset.trim();
      if (pendingTitle) {
        finalDocs.push({
          d_name: pendingTitle,
          d_link: docFileUrl || `/uploads/${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        });
      }
    }

    setIsSubmitting(true);
    try {
      await onStartRent({
        p_id: targetPid,
        tenant_name: trimmedTenant,
        tenant_contact: tenantContact.trim(),
        rent_amount: rentNum,
        rent_start_date: startDate,
        rent_end_date: endDate || undefined,
        documents: finalDocs.length > 0 ? finalDocs : undefined
      });

      if (onShowToast) {
        onShowToast(`Rental details added for "${trimmedTenant}"!`, 'success');
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to start rent:', err);
      setError(err?.message || 'Failed to save rent details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
                Add Rent Details
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {currentSelectedProp?.name || 'Link rental to a property'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 3. Property Association */}
          <div className="form-group">
            <label className="form-label" htmlFor="rentPropertySelect">
              Property Details <span className="text-required">*</span>
            </label>
            {activePropertyList.length > 1 ? (
              <select
                id="rentPropertySelect"
                className="form-input"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                required
              >
                {activePropertyList.map((p) => (
                  <option key={p.p_id} value={p.p_id}>
                    {p.name} {p.location ? `— ${p.location}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface-soft)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-navy)'
                }}
              >
                <Building size={15} style={{ color: 'var(--color-charcoal-muted)' }} />
                <span>{currentSelectedProp?.name || 'Selected Property'}</span>
                {currentSelectedProp?.location && (
                  <span style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', fontWeight: 400 }}>
                    ({currentSelectedProp.location})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 1 & 2. Tenant Name & Tenant Contact Number */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="tenantName">
                Tenant Name <span className="text-required">*</span>
              </label>
              <input
                id="tenantName"
                type="text"
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="tenantContact">
                Tenant Contact Number <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="tenantContact"
                type="text"
                className="form-input"
                placeholder="e.g. +91 98765 43210"
                value={tenantContact}
                onChange={(e) => setTenantContact(e.target.value)}
              />
            </div>
          </div>

          {/* 4. Monthly Rent */}
          <div className="form-group">
            <label className="form-label" htmlFor="rentAmount">
              Monthly Rent (₹) <span className="text-required">*</span>
            </label>
            <input
              id="rentAmount"
              type="number"
              min="1"
              step="any"
              className="form-input"
              placeholder="e.g. 20000"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              required
            />
          </div>

          {/* 6 & 7. Rent Start Date & Rent End Date (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="rentStartDate">
                Rent Start Date <span className="text-required">*</span>
              </label>
              <input
                id="rentStartDate"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="rentEndDate">
                Rent End Date <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="rentEndDate"
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Only when leaving"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                Only when leaving / lease ends
              </span>
            </div>
          </div>

          {/* 5. Rent Documents Section */}
          <div
            style={{
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '14px',
              background: 'var(--bg-surface-soft)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: 'var(--color-navy)' }}>
                Rent Documents ({documents.length})
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Agreement, ID proof, receipts
              </span>
            </div>

            {/* List of staged documents */}
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
                      background: 'var(--bg-surface)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-light)',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <FileText size={14} style={{ color: '#D97706', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--color-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.d_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-charcoal-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Remove document"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload document box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: documents.length > 0 ? '8px' : '0', borderTop: documents.length > 0 ? '1px dashed var(--border-light)' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: docTypePreset === 'Other Document' ? '1fr 1fr' : '1fr', gap: '8px' }}>
                <select
                  className="form-input"
                  style={{ fontSize: '12px', height: '32px' }}
                  value={docTypePreset}
                  onChange={(e) => setDocTypePreset(e.target.value)}
                >
                  <option value="Rent Agreement">Rent Agreement</option>
                  <option value="Tenant ID Proof (Aadhaar / Passport)">Tenant ID Proof</option>
                  <option value="Police Verification">Police Verification</option>
                  <option value="Deposit Receipt">Deposit Receipt</option>
                  <option value="Other Document">Other Document</option>
                </select>

                {docTypePreset === 'Other Document' && (
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '12px', height: '32px' }}
                    placeholder="Document Title"
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                  />
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    border: '1px dashed var(--border-card)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: 'var(--bg-surface)',
                    fontSize: '12px',
                    color: 'var(--color-navy)',
                    height: '32px'
                  }}
                >
                  {isUploadingDoc ? (
                    <>
                      <Loader2 size={13} className="spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                        {docFileName || 'Choose File (PDF/Image)'}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    disabled={isUploadingDoc}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  />
                </label>

                {(docFileUrl || docFileName) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddDoc}
                    disabled={isUploadingDoc}
                    style={{ fontSize: '12px', padding: '5px 10px', height: '32px' }}
                  >
                    <Plus size={13} style={{ marginRight: '3px' }} />
                    Attach
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
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
              disabled={isSubmitting || isUploadingDoc}
              style={{ background: '#16A34A', borderColor: '#16A34A', minWidth: '130px' }}
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <Check size={15} style={{ marginRight: '6px' }} />
                  Save Rent Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
