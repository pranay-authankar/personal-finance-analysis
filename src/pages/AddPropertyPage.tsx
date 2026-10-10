import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { PropertyType } from '../types';
import { normalizePropertyType } from '../utils/realEstateUiHelpers';
import { formatCurrency } from '../utils/calculations';
import { uploadDocumentFile } from '../utils/fileUpload';
import {
  ChevronLeft,
  Building,
  Plus,
  Trash2,
  FileText,
  Upload,
  Loader2,
  KeyRound,
  Wallet
} from 'lucide-react';

interface AddPropertyPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
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

export const AddPropertyPage: React.FC<AddPropertyPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { addProperty, updateProperty, startRent, getPropertyById } = useInvestments();

  // Basic Property Fields
  const [pType, setPType] = useState<PropertyType>('LAND');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [partyName, setPartyName] = useState('');
  const [partyContact, setPartyContact] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  // Initial Payment & Balance Payment Due Date
  const [initialPayment, setInitialPayment] = useState<string>('');
  const [paymentDeadline, setPaymentDeadline] = useState<string>('');

  // Rental Setup Option
  const [isRented, setIsRented] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantContact, setTenantContact] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [rentStartDate, setRentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextRentDue, setNextRentDue] = useState('');
  const [rentNotes, setRentNotes] = useState('');

  // Documents
  const [documents, setDocuments] = useState<AttachedDoc[]>([]);
  const [docTypePreset, setDocTypePreset] = useState('Sale Deed');
  const [customDocName, setCustomDocName] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Load existing property when editing
  useEffect(() => {
    if (editId) {
      const existing = getPropertyById(editId);
      if (existing) {
        setPType(normalizePropertyType(existing.p_type));
        setName(existing.name || '');
        setLocation(existing.location || '');
        setPurchasePrice(
          existing.purchase_price !== undefined && existing.purchase_price > 0
            ? String(existing.purchase_price)
            : ''
        );
        setPartyName(existing.party_name || '');
        setPartyContact(existing.party_contact || '');
        setPurchaseDate(existing.purchase_date || '');
        setNotes(existing.p_notes || '');
        setPaymentDeadline(existing.payment_deadline || '');
      }
    }
  }, [editId, getPropertyById]);

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

    if (editId) {
      updateProperty(editId, {
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
      navigate(`/real-estate/${editId}`);
    } else {
      const created = addProperty(
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

      if (isRented && tenantName.trim() && Number(rentAmount) > 0) {
        startRent(created.p_id, {
          tenant_name: tenantName.trim(),
          tenant_contact: tenantContact.trim(),
          rent_amount: Number(rentAmount),
          rent_start_date: rentStartDate || purchaseDate || new Date().toISOString().split('T')[0],
          next_rent_due: nextRentDue || purchaseDate || new Date().toISOString().split('T')[0],
          r_notes: rentNotes.trim()
        });
      }

      onShowToast(`Property "${trimmedName}" added to portfolio!`, 'success');
      navigate(`/real-estate/${created.p_id}`);
    }
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/real-estate')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--color-charcoal-light)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <ChevronLeft size={16} />
          <span>Back to Real Estate</span>
        </button>
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(15, 30, 54, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-navy)'
            }}
          >
            <Building size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--color-navy)' }}>
              {editId ? 'Edit Property' : 'Add Property'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)', margin: '2px 0 0 0' }}>
              Real estate portfolio holding &amp; terms
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* 1. Property Type Selector */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-navy)', marginBottom: '8px' }}>
              Property Type <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {PROPERTY_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPType(t.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '12px 8px',
                    borderRadius: '10px',
                    border: pType === t.id ? '2px solid var(--color-navy)' : '1px solid var(--border-subtle)',
                    background: pType === t.id ? 'rgba(15, 30, 54, 0.04)' : '#FFFFFF',
                    color: pType === t.id ? 'var(--color-navy)' : 'var(--color-charcoal-light)',
                    cursor: 'pointer',
                    fontWeight: pType === t.id ? 700 : 500,
                    fontSize: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Property Name & Location */}
          <div className="form-group">
            <label className="form-label" htmlFor="pagePropName" style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
              Property Name <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <input
              id="pagePropName"
              type="text"
              className="form-input"
              placeholder="e.g. Green Valley Plot 42 / Tech Park Suite"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pageLocation" style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
              Location / City <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <input
              id="pageLocation"
              type="text"
              className="form-input"
              placeholder="e.g. Baner, Pune / Whitefield, Bengaluru"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          {/* 3. Purchase Price & Payment Terms */}
          <div style={{ background: 'var(--bg-surface-soft)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Wallet size={16} color="var(--color-navy)" />
              <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-navy)', letterSpacing: '0.04em' }}>
                Purchase &amp; Payment Terms
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pagePurchasePrice" style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                  Purchase Price (₹) <span style={{ color: 'var(--color-gold)' }}>*</span>
                </label>
                <input
                  id="pagePurchasePrice"
                  type="number"
                  min="0"
                  step="any"
                  className="form-input"
                  placeholder="e.g. 5000000"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pagePurchaseDate">
                  Purchase Date <span className="text-optional">(Optional)</span>
                </label>
                <input
                  id="pagePurchaseDate"
                  type="date"
                  className="form-input"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            {/* Initial Payment & Deadline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pageInitial">
                  Initial / Down Payment (₹) <span className="text-optional">(Optional)</span>
                </label>
                <input
                  id="pageInitial"
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
                <label className="form-label" htmlFor="pageDeadline">
                  Balance Payment Deadline <span className="text-optional">(Optional)</span>
                </label>
                <input
                  id="pageDeadline"
                  type="date"
                  className="form-input"
                  value={paymentDeadline}
                  onChange={(e) => setPaymentDeadline(e.target.value)}
                />
              </div>
            </div>

            {/* Balance Due calculation */}
            {numPrice > 0 && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: remainingBalance > 0 ? 'rgba(217, 119, 6, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: `1px solid ${remainingBalance > 0 ? 'rgba(217, 119, 6, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px'
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

          {/* 4. Seller / Party Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="pagePartyName">
                Seller / Party Name <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="pagePartyName"
                type="text"
                className="form-input"
                placeholder="e.g. Prestige Estates / Ramesh Kulkarni"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pagePartyContact">
                Party Contact <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="pagePartyContact"
                type="text"
                className="form-input"
                placeholder="e.g. +91 98765 43210"
                value={partyContact}
                onChange={(e) => setPartyContact(e.target.value)}
              />
            </div>
          </div>

          {/* 5. Rental Setup Option */}
          {!editId && (
            <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '12px', border: '1px solid #FDE68A' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={18} color="#D97706" />
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#92400E' }}>
                      Is this property currently rented out?
                    </span>
                    <p style={{ margin: 0, fontSize: '12px', color: '#B45309' }}>
                      Track monthly rental yield and lease schedules
                    </p>
                  </div>
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isRented}
                    onChange={(e) => setIsRented(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#D97706' }}
                  />
                  <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600, color: '#92400E' }}>
                    {isRented ? 'Yes, Rented' : 'No / Vacant'}
                  </span>
                </label>
              </div>

              {isRented && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }} className="fade-in">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                        Lease Start Date <span className="text-optional">(Optional)</span>
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={rentStartDate}
                        onChange={(e) => setRentStartDate(e.target.value)}
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

                  <div className="form-group">
                    <label className="form-label" style={{ color: '#92400E' }}>
                      Rental Notes <span className="text-optional">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 11 months agreement, 2 months deposit collected"
                      value={rentNotes}
                      onChange={(e) => setRentNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Documents Section */}
          <div style={{ background: 'var(--bg-surface-soft)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} color="var(--color-navy)" />
                <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-navy)', letterSpacing: '0.04em' }}>
                  Property Documents ({documents.length})
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)' }}>
                Deeds, agreements, NOCs
              </span>
            </div>

            {/* List of docs */}
            {documents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {documents.map((d, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid var(--border-card)',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <FileText size={15} color="var(--color-navy)" />
                      <span style={{ fontWeight: 600, color: 'var(--color-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.d_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '4px' }}
                      title="Remove document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: docTypePreset === 'Other Document' ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px' }}>
                  Document Type
                </label>
                <select
                  className="form-input"
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
                  <label className="form-label" style={{ fontSize: '12px' }}>
                    Document Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Society NOC / Tax Receipt"
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                border: '1px dashed var(--border-medium)',
                borderRadius: '8px',
                padding: '14px 16px',
                textAlign: 'center',
                background: '#FFFFFF',
                cursor: isUploadingDoc ? 'not-allowed' : 'pointer',
                marginBottom: '10px'
              }}
              onClick={() => {
                if (!isUploadingDoc) {
                  document.getElementById('page-property-doc-upload')?.click();
                }
              }}
            >
              <input
                id="page-property-doc-upload"
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                disabled={isUploadingDoc}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {isUploadingDoc ? (
                  <Loader2 size={18} className="spin" color="var(--color-navy)" />
                ) : (
                  <Upload size={18} color="var(--color-navy)" />
                )}
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)' }}>
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
                style={{ width: '100%', fontSize: '13px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Plus size={15} />
                <span>Add "{docTypePreset === 'Other Document' ? customDocName || 'Custom Doc' : docTypePreset}"</span>
              </button>
            )}
          </div>

          {/* 7. Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="pagePropNotes">
              Notes <span className="text-optional">(Optional)</span>
            </label>
            <textarea
              id="pagePropNotes"
              className="form-input"
              rows={3}
              placeholder="e.g. Registered at Indiranagar Sub-Registrar office, khata transfer in progress"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/real-estate')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: 'var(--color-navy)', minWidth: '150px' }}
            >
              {editId ? 'Save Changes' : 'Save Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyPage;
