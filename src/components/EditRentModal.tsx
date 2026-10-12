import React, { useState, useEffect } from 'react';
import type { PropertyRecord, RentRecord, DocumentRecord } from '../types';
import { useInvestments } from '../context/InvestmentContext';
import { X, KeyRound, AlertCircle, Check, Building, Trash2, FileText, Upload, Plus, Loader2, ExternalLink } from 'lucide-react';
import { uploadDocumentFile } from '../utils/fileUpload';

interface EditRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyRecord;
  activeRent: RentRecord;
  properties?: PropertyRecord[];
  onSaveRent: (updates: Partial<RentRecord>) => Promise<void>;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const EditRentModal: React.FC<EditRentModalProps> = ({
  isOpen,
  onClose,
  property,
  activeRent,
  properties = [],
  onSaveRent,
  onShowToast
}) => {
  const { getDocumentsForRent, addDocument, removeDocument } = useInvestments();

  // Active property list for property association dropdown
  const activePropertyList = properties.length > 0
    ? properties
    : [property];

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(activeRent?.p_id || property.p_id);
  const [tenantName, setTenantName] = useState('');
  const [tenantContact, setTenantContact] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Documents state
  const [existingDocs, setExistingDocs] = useState<DocumentRecord[]>([]);
  const [docTypePreset, setDocTypePreset] = useState<string>('Rent Agreement');
  const [customDocName, setCustomDocName] = useState<string>('');
  const [docFileUrl, setDocFileUrl] = useState<string>('');
  const [docFileName, setDocFileName] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeRent && isOpen) {
      setSelectedPropertyId(activeRent.p_id || property.p_id);
      setTenantName(activeRent.tenant_name || '');
      setTenantContact(activeRent.tenant_contact || '');
      setRentAmount(String(activeRent.rent_amount || ''));
      setStartDate(activeRent.rent_start_date || '');
      setEndDate(activeRent.rent_end_date || '');
      setError('');

      // Fetch documents for this rent
      const docs = getDocumentsForRent(activeRent.p_id || property.p_id, activeRent.r_id);
      setExistingDocs(docs);
    }
  }, [activeRent, property, isOpen, getDocumentsForRent]);

  if (!isOpen) return null;

  const numAmount = Number(rentAmount) || 0;
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

  const handleAddDoc = async () => {
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

    try {
      const link = docFileUrl || `/uploads/${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const newDoc = addDocument(selectedPropertyId, {
        d_name: title,
        d_link: link,
        r_id: activeRent.r_id,
        d_category: 'RENT'
      });

      setExistingDocs((prev) => [...prev, newDoc]);
      setDocTypePreset('Rent Agreement');
      setCustomDocName('');
      setDocFileUrl('');
      setDocFileName('');
      setError('');
      if (onShowToast) {
        onShowToast(`Document "${title}" uploaded and attached!`, 'success');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to attach document');
    }
  };

  const handleRemoveExistingDoc = async (d_id: string, docName: string) => {
    if (window.confirm(`Remove document "${docName}"?`)) {
      try {
        removeDocument(d_id);
        setExistingDocs((prev) => prev.filter((d) => d.d_id !== d_id));
        if (onShowToast) {
          onShowToast(`Document "${docName}" removed.`, 'info');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to remove document');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedTenant = tenantName.trim();
    if (!trimmedTenant) {
      setError('Please provide a tenant name');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid monthly rent amount in ₹');
      return;
    }

    if (!startDate) {
      setError('Please provide the rent start date');
      return;
    }

    setIsSubmitting(true);
    try {
      // If there's an attached file pending in the upload inputs, add it before saving
      if (docFileUrl || docFileName) {
        const pendingTitle = docTypePreset === 'Other Document' ? customDocName.trim() : docTypePreset.trim();
        if (pendingTitle) {
          const link = docFileUrl || `/uploads/${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          addDocument(selectedPropertyId, {
            d_name: pendingTitle,
            d_link: link,
            r_id: activeRent.r_id,
            d_category: 'RENT'
          });
        }
      }

      await onSaveRent({
        p_id: selectedPropertyId,
        tenant_name: trimmedTenant,
        tenant_contact: tenantContact.trim(),
        rent_amount: numAmount,
        rent_start_date: startDate,
        rent_end_date: endDate || ''
      });

      if (onShowToast) {
        onShowToast(`Rent details for "${trimmedTenant}" updated!`, 'success');
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to update rent:', err);
      setError(err?.message || 'Failed to update rent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay bullion-modal-overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content-box bullion-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="bullion-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="bullion-modal-icon-badge" style={{ background: 'rgba(15, 30, 54, 0.08)', color: 'var(--color-navy)' }}>
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="bullion-modal-title">Edit Rent Details</h2>
              <span className="bullion-modal-sub">
                {currentSelectedProp?.name || property.name} • Tenancy Details
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

          {/* 3. Property Association */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="editPropertySelect">
              Property Details <span className="text-required">*</span>
            </label>
            {activePropertyList.length > 1 ? (
              <select
                id="editPropertySelect"
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
                <span>{property.name}</span>
                {property.location && (
                  <span style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', fontWeight: 400 }}>
                    ({property.location})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 1 & 2. Tenant Name & Tenant Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="editTenantName">
                Tenant Name <span className="text-required">*</span>
              </label>
              <input
                id="editTenantName"
                type="text"
                className="form-input"
                placeholder="e.g. Ramesh Kumar"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editTenantContact">
                Tenant Contact Number <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="editTenantContact"
                type="text"
                className="form-input"
                placeholder="e.g. +91 98765 43210"
                value={tenantContact}
                onChange={(e) => setTenantContact(e.target.value)}
              />
            </div>
          </div>

          {/* 4. Monthly Rent */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="editRentAmount">
              Monthly Rent (₹) <span className="text-required">*</span>
            </label>
            <input
              id="editRentAmount"
              type="number"
              min="1"
              step="any"
              className="form-input"
              placeholder="e.g. 25000"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              required
            />
          </div>

          {/* 6 & 7. Rent Start Date & Rent End Date (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="editRentStartDate">
                Rent Start Date <span className="text-required">*</span>
              </label>
              <input
                id="editRentStartDate"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editRentEndDate">
                Rent End Date <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="editRentEndDate"
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
              background: 'var(--bg-surface-soft)',
              marginBottom: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: 'var(--color-navy)' }}>
                Rent Documents ({existingDocs.length})
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Upload, view, and manage documents
              </span>
            </div>

            {/* List of existing documents */}
            {existingDocs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {existingDocs.map((doc) => (
                  <div
                    key={doc.d_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'var(--bg-surface)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-light)',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={15} style={{ color: '#D97706', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--color-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.d_name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {doc.d_link && (
                        <a
                          href={doc.d_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            color: '#2563EB',
                            textDecoration: 'none',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          <ExternalLink size={12} />
                          <span>View</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingDoc(doc.d_id, doc.d_name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Delete document"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new document to this rental */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: existingDocs.length > 0 ? '8px' : '0', borderTop: existingDocs.length > 0 ? '1px dashed var(--border-light)' : 'none' }}>
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
                        {docFileName || 'Choose Document File'}
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
                    Upload
                  </button>
                )}
              </div>
            </div>
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
              disabled={isSubmitting || isUploadingDoc}
              style={{ background: 'var(--color-navy)', minWidth: '140px' }}
            >
              {isSubmitting ? 'Saving...' : (
                <>
                  <Check size={15} style={{ marginRight: '6px' }} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
