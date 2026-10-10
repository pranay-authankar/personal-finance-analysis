import React, { useState, useEffect } from 'react';
import { useInvestments } from '../context/InvestmentContext';
import type { PropertyRecord, PropertyType } from '../types';
import { normalizePropertyType } from '../utils/realEstateUiHelpers';
import { formatCurrency } from '../utils/calculations';
import { uploadDocumentFile } from '../utils/fileUpload';
import {
  X,
  Building,
  Plus,
  Trash2,
  FileText,
  Upload,
  Loader2,
  KeyRound,
  Wallet
} from 'lucide-react';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyToEdit?: PropertyRecord | null;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  onSaved?: (saved: PropertyRecord) => void;
}

interface AttachedDoc {
  d_name: string;
  d_link: string;
}

const PROPERTY_TYPES: { id: PropertyType; label: string; icon: string }[] = [
  { id: 'LAND', label: 'Land Plot', icon: '🌱' },
  { id: 'COMMERCIAL_PROPERTY', label: 'Commercial', icon: '🏢' },
  { id: 'PRIVATE_HOUSE', label: 'Private House', icon: '🏡' }
];

const DOCUMENT_PRESETS = [
  'Sale Deed',
  'Registry / Title Deed',
  'Agreement to Sell',
  'Property Tax Paid Receipt',
  'Khata / 7/12 Land Extract',
  'Possession / Allotment Letter',
  'Encumbrance Certificate (EC)',
  'Building Plan Sanction / RERA Approval',
  'Other Document'
];

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  propertyToEdit,
  onShowToast,
  onSaved
}) => {
  const { addProperty, updateProperty, startRent } = useInvestments();

  // Basic Property Fields
  const [pType, setPType] = useState<PropertyType>('LAND');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [partyName, setPartyName] = useState('');
  const [partyContact, setPartyContact] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Initial Payment & Balance Due Date
  const [initialPayment, setInitialPayment] = useState<string>('');
  const [paymentDeadline, setPaymentDeadline] = useState<string>('');

  // Rental Setup Option
  const [isRented, setIsRented] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantContact, setTenantContact] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [rentStartDate, setRentStartDate] = useState('');
  const [nextRentDue, setNextRentDue] = useState('');
  const [rentNotes, setRentNotes] = useState('');

  // Documents
  const [documents, setDocuments] = useState<AttachedDoc[]>([]);
  const [docTypePreset, setDocTypePreset] = useState('Sale Deed');
  const [customDocName, setCustomDocName] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Sync state when opening or editing
  useEffect(() => {
    if (propertyToEdit) {
      setPType(normalizePropertyType(propertyToEdit.p_type));
      setName(propertyToEdit.name || '');
      setLocation(propertyToEdit.location || '');
      setPurchasePrice(
        propertyToEdit.purchase_price !== undefined && propertyToEdit.purchase_price > 0
          ? String(propertyToEdit.purchase_price)
          : ''
      );
      setPartyName(propertyToEdit.party_name || '');
      setPartyContact(propertyToEdit.party_contact || '');
      setPurchaseDate(propertyToEdit.purchase_date || '');
      setNotes(propertyToEdit.p_notes || '');
      setInitialPayment('');
      setPaymentDeadline(propertyToEdit.payment_deadline || '');
      setIsRented(false);
      setTenantName('');
      setTenantContact('');
      setRentAmount('');
      setRentStartDate('');
      setNextRentDue('');
      setRentNotes('');
      setDocuments([]);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setPType('LAND');
      setName('');
      setLocation('');
      setPurchasePrice('');
      setPartyName('');
      setPartyContact('');
      setPurchaseDate(today);
      setNotes('');
      setInitialPayment('');
      setPaymentDeadline('');
      setIsRented(false);
      setTenantName('');
      setTenantContact('');
      setRentAmount('');
      setRentStartDate(today);
      setNextRentDue('');
      setRentNotes('');
      setDocuments([]);
      setDocTypePreset('Sale Deed');
      setCustomDocName('');
      setDocFileName('');
      setDocFileUrl('');
    }
  }, [propertyToEdit, isOpen]);

  if (!isOpen) return null;

  const numPrice = Number(purchasePrice) || 0;
  const numInitial = initialPayment !== '' ? Number(initialPayment) : 0;
  const remainingBalance = Math.max(0, numPrice - numInitial);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      onShowToast('Document file exceeds 8MB size limit.', 'warn');
      return;
    }

    setDocFileName(file.name);
    setIsUploadingDoc(true);

    try {
      const uploadedUrl = await uploadDocumentFile(file);
      setDocFileUrl(uploadedUrl);
    } catch {
      onShowToast('Failed to process document file.', 'warn');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleAttachDocument = () => {
    const title = docTypePreset === 'Other Document' ? customDocName.trim() : docTypePreset.trim();
    if (!title) {
      onShowToast('Please provide a document title.', 'warn');
      return;
    }
    if (!docFileUrl && !docFileName) {
      onShowToast('Please upload a document file to attach.', 'warn');
      return;
    }

    const newDoc: AttachedDoc = {
      d_name: title,
      d_link: docFileUrl || `/uploads/${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    };

    setDocuments((prev) => [...prev, newDoc]);
    setDocFileName('');
    setDocFileUrl('');
    setCustomDocName('');
    setDocTypePreset('Sale Deed');
  };

  const handleRemoveDoc = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedLocation = location.trim();

    if (!trimmedName) {
      onShowToast('Please provide a property name.', 'warn');
      return;
    }
    if (!trimmedLocation) {
      onShowToast('Please provide the property location.', 'warn');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      onShowToast('Please enter a valid purchase price in ₹.', 'warn');
      return;
    }
    if (numInitial > numPrice) {
      onShowToast('Initial payment cannot exceed the total purchase price.', 'warn');
      return;
    }
    if (isUploadingDoc) {
      onShowToast('Please wait for the document to finish uploading.', 'warn');
      return;
    }

    // Auto-include pending document if uploaded but not clicked attach
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

    if (propertyToEdit) {
      updateProperty(propertyToEdit.p_id, {
        p_type: pType,
        name: trimmedName,
        location: trimmedLocation,
        purchase_price: numPrice,
        party_name: partyName.trim(),
        party_contact: partyContact.trim(),
        purchase_date: purchaseDate || undefined,
        p_notes: notes.trim(),
        payment_deadline: paymentDeadline || undefined
      });

      onShowToast(`Property "${trimmedName}" updated!`, 'success');
      if (onSaved) {
        onSaved({
          ...propertyToEdit,
          p_type: pType,
          name: trimmedName,
          location: trimmedLocation,
          purchase_price: numPrice,
          party_name: partyName.trim(),
          party_contact: partyContact.trim(),
          purchase_date: purchaseDate || '',
          p_notes: notes.trim(),
          payment_deadline: paymentDeadline || ''
        });
      }
    } else {
      const saved = addProperty(
        {
          p_type: pType,
          name: trimmedName,
          location: trimmedLocation,
          purchase_price: numPrice,
          party_name: partyName.trim(),
          party_contact: partyContact.trim(),
          purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
          p_notes: notes.trim(),
          initial_payment: numInitial > 0 ? numInitial : undefined,
          payment_deadline: paymentDeadline || undefined
        },
        finalDocs.length > 0 ? finalDocs : undefined
      );

      // If user enabled rental setup on creation, initialize the lease!
      if (isRented && tenantName.trim() && Number(rentAmount) > 0) {
        startRent(saved.p_id, {
          tenant_name: tenantName.trim(),
          tenant_contact: tenantContact.trim(),
          rent_amount: Number(rentAmount),
          rent_start_date: rentStartDate || purchaseDate || new Date().toISOString().split('T')[0],
          next_rent_due: nextRentDue || purchaseDate || new Date().toISOString().split('T')[0],
          r_notes: rentNotes.trim()
        });
      }

      onShowToast(`Property "${trimmedName}" added to portfolio!`, 'success');
      if (onSaved) onSaved(saved);
    }

    onClose();
  };

  return (
    <div className="modal-overlay bullion-modal-overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content-box bullion-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="bullion-modal-header" style={{ position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="bullion-modal-icon-badge">
              <Building size={18} />
            </div>
            <div>
              <h2 className="bullion-modal-title">
                {propertyToEdit ? 'Edit Property' : 'Add Property'}
              </h2>
              <span className="bullion-modal-sub">
                Real estate investment holding &amp; terms
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="bullion-modal-form" style={{ padding: '4px 0 16px' }}>
          {/* SECTION 1: Property Identification */}
          <div className="form-group">
            <label className="form-label">
              Property Type <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <div className="bullion-chips-row">
              {PROPERTY_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  className={`bullion-chip-btn ${pType === pt.id ? 'active' : ''}`}
                  onClick={() => setPType(pt.id)}
                >
                  <span style={{ marginRight: '4px' }}>{pt.icon}</span>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="reModalName">
                Property Name <span style={{ color: 'var(--color-gold)' }}>*</span>
              </label>
              <input
                id="reModalName"
                type="text"
                className="form-input"
                placeholder="e.g. Green Valley Plot 42 / Tech Park Suite"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reModalLocation">
                Location / City <span style={{ color: 'var(--color-gold)' }}>*</span>
              </label>
              <input
                id="reModalLocation"
                type="text"
                className="form-input"
                placeholder="e.g. Baner, Pune / Whitefield, Bengaluru"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
          </div>

          {/* SECTION 2: Purchase Price & Payment Terms */}
          <div style={{ background: 'var(--bg-surface-soft)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Wallet size={15} color="var(--color-navy)" />
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-navy)', letterSpacing: '0.04em' }}>
                Purchase &amp; Payment Terms
              </span>
            </div>

            <div className="form-row-2col" style={{ marginBottom: '10px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reModalPrice">
                  Purchase Price (₹) <span style={{ color: 'var(--color-gold)' }}>*</span>
                </label>
                <div className="input-affix-wrapper">
                  <span className="input-prefix" style={{ color: 'var(--color-gold)' }}>₹</span>
                  <input
                    id="reModalPrice"
                    type="number"
                    min="0"
                    step="any"
                    className="form-input input-with-prefix"
                    placeholder="e.g. 5000000"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reModalDate">
                  Purchase Date <span className="text-optional">(Optional)</span>
                </label>
                <input
                  id="reModalDate"
                  type="date"
                  className="form-input"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            {/* Initial Payment & Balance Payment Due Date (Feature 2) */}
            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label" htmlFor="reModalInitial">
                  Initial / Down Payment (₹) <span className="text-optional">(Optional)</span>
                </label>
                <input
                  id="reModalInitial"
                  type="number"
                  min="0"
                  max={numPrice || undefined}
                  step="any"
                  className="form-input"
                  placeholder="e.g. 1000000 (Paid at booking)"
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reModalDeadline">
                  Balance Payment Deadline <span className="text-optional">(Optional)</span>
                </label>
                <input
                  id="reModalDeadline"
                  type="date"
                  className="form-input"
                  value={paymentDeadline}
                  onChange={(e) => setPaymentDeadline(e.target.value)}
                />
              </div>
            </div>

            {/* Dynamic Balance Due Preview */}
            {numPrice > 0 && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: remainingBalance > 0 ? 'rgba(217, 119, 6, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: `1px solid ${remainingBalance > 0 ? 'rgba(217, 119, 6, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}
              >
                <span>
                  <strong>Balance Due:</strong> ₹ {formatCurrency(remainingBalance)}
                  {paymentDeadline && remainingBalance > 0 && (
                    <span style={{ color: 'var(--color-charcoal-muted)', marginLeft: '6px' }}>
                      (Due by {paymentDeadline})
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: 600, color: remainingBalance > 0 ? '#B45309' : '#047857' }}>
                  {remainingBalance === 0 && numInitial > 0
                    ? '✓ 100% Fully Paid'
                    : numInitial > 0
                    ? `₹ ${formatCurrency(numInitial)} Paid (${Math.round((numInitial / numPrice) * 100)}%)`
                    : 'Full balance pending'}
                </span>
              </div>
            )}
          </div>

          {/* SECTION 3: Seller / Party Details */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="reModalPartyName">
                Seller / Party Name <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="reModalPartyName"
                type="text"
                className="form-input"
                placeholder="e.g. Prestige Estates / Ramesh Kulkarni"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reModalPartyContact">
                Party Contact <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="reModalPartyContact"
                type="text"
                className="form-input"
                placeholder="e.g. +91 98765 43210"
                value={partyContact}
                onChange={(e) => setPartyContact(e.target.value)}
              />
            </div>
          </div>

          {/* SECTION 4: Rental Setup Option (Feature 3) */}
          {!propertyToEdit && (
            <div style={{ background: '#FFFBEB', padding: '14px', borderRadius: '10px', border: '1px solid #FDE68A' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={16} color="#D97706" />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
                      Is this property currently rented out?
                    </span>
                    <p style={{ margin: 0, fontSize: '11px', color: '#B45309' }}>
                      Track monthly tenant rental income and lease schedules
                    </p>
                  </div>
                </div>

                <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isRented}
                    onChange={(e) => setIsRented(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#D97706' }}
                  />
                  <span style={{ marginLeft: '6px', fontSize: '12px', fontWeight: 600, color: '#92400E' }}>
                    {isRented ? 'Yes, Rented' : 'No / Vacant'}
                  </span>
                </label>
              </div>

              {isRented && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }} className="fade-in">
                  <div className="form-row-2col">
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#92400E' }}>
                        Tenant Name <span style={{ color: 'var(--color-gold)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Infosys Corp / Dr. Sharma"
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        required={isRented}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#92400E' }}>
                        Tenant Contact <span className="text-optional">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. +91 99887 76655"
                        value={tenantContact}
                        onChange={(e) => setTenantContact(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row-2col">
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#92400E' }}>
                        Monthly Rent (₹/mo) <span style={{ color: 'var(--color-gold)' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-input"
                        placeholder="e.g. 35000"
                        value={rentAmount}
                        onChange={(e) => setRentAmount(e.target.value)}
                        required={isRented}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#92400E' }}>
                        Next Rent Due Date <span className="text-optional">(Optional)</span>
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={nextRentDue}
                        onChange={(e) => setNextRentDue(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: Add Documents Section (Feature 1) */}
          <div style={{ background: 'var(--bg-surface-soft)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={15} color="var(--color-navy)" />
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-navy)', letterSpacing: '0.04em' }}>
                  Property Documents ({documents.length})
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>
                Sale deed, title papers, agreements
              </span>
            </div>

            {/* List of already attached docs */}
            {documents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {documents.map((d, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: '#FFFFFF',
                      borderRadius: '6px',
                      border: '1px solid var(--border-card)',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <FileText size={14} color="var(--color-navy)" />
                      <span style={{ fontWeight: 600, color: 'var(--color-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.d_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '2px' }}
                      title="Remove document"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Document attachment controls */}
            <div style={{ display: 'grid', gridTemplateColumns: docTypePreset === 'Other Document' ? '1fr 1fr' : '1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Document Type
                </label>
                <select
                  className="form-input"
                  style={{ fontSize: '12px', padding: '6px 8px' }}
                  value={docTypePreset}
                  onChange={(e) => setDocTypePreset(e.target.value)}
                >
                  {DOCUMENT_PRESETS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {docTypePreset === 'Other Document' && (
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>
                    Document Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                    placeholder="e.g. Society NOC / Tax Receipt"
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* File Upload Dropzone */}
            <div
              style={{
                border: '1px dashed var(--border-medium)',
                borderRadius: '8px',
                padding: '10px 14px',
                textAlign: 'center',
                background: '#FFFFFF',
                cursor: isUploadingDoc ? 'not-allowed' : 'pointer',
                marginBottom: '8px'
              }}
              onClick={() => {
                if (!isUploadingDoc) {
                  document.getElementById('modal-property-doc-upload')?.click();
                }
              }}
            >
              <input
                id="modal-property-doc-upload"
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                disabled={isUploadingDoc}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {isUploadingDoc ? (
                  <Loader2 size={16} className="spin" color="var(--color-navy)" />
                ) : (
                  <Upload size={16} color="var(--color-navy)" />
                )}
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-navy)' }}>
                  {isUploadingDoc
                    ? 'Uploading file...'
                    : docFileName
                    ? `✓ Selected: ${docFileName}`
                    : 'Click to select PDF or image file (max 8MB)'}
                </span>
              </div>
            </div>

            {docFileName && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAttachDocument}
                disabled={isUploadingDoc}
                style={{ width: '100%', fontSize: '12px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Plus size={14} />
                <span>Add "{docTypePreset === 'Other Document' ? customDocName || 'Custom Doc' : docTypePreset}" to Property</span>
              </button>
            )}
          </div>

          {/* SECTION 6: Notes */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" htmlFor="reModalNotes">
              Notes <span className="text-optional">(Optional)</span>
            </label>
            <textarea
              id="reModalNotes"
              rows={2}
              className="form-input"
              placeholder="e.g. Registered in sub-registrar office, khata transfer pending"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="bullion-modal-actions" style={{ position: 'sticky', bottom: 0, background: '#FFFFFF', paddingTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: 'var(--color-navy)', minWidth: '140px' }}
            >
              {propertyToEdit ? 'Save Changes' : 'Save Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyModal;
