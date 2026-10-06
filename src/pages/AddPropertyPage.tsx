import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { PropertyType } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { PROPERTY_TYPE_CONFIG } from '../utils/deadlinesColorMap';
import { uploadDocumentFile } from '../utils/fileUpload';
import {
  ChevronLeft,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  Check,
  Building,
  Upload,
  Wallet,
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface AddPropertyPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

interface NewDocItem {
  d_name: string;
  d_link: string;
}

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
  const { addProperty } = useInvestments();

  // Form Fields
  const [selectedType, setSelectedType] = useState<PropertyType>('LAND');
  const [name, setName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [areaSqft, setAreaSqft] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [partyName, setPartyName] = useState<string>('');
  const [partyContact, setPartyContact] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');

  // Initial Payment & Deadline
  const [initialPayment, setInitialPayment] = useState<string>('');
  const [paymentDeadline, setPaymentDeadline] = useState<string>('');

  // Documents
  const [documents, setDocuments] = useState<NewDocItem[]>([]);
  const [docTypePreset, setDocTypePreset] = useState<string>('Sale Deed');
  const [customDocName, setCustomDocName] = useState<string>('');
  const [docFileUrl, setDocFileUrl] = useState<string>('');
  const [docFileName, setDocFileName] = useState<string>('');

  const [error, setError] = useState<string>('');

  const numPrice = Number(purchasePrice) || 0;
  // If user hasn't typed initial payment, default calculation treats empty as 0
  const numInitial = initialPayment !== '' ? Number(initialPayment) : 0;
  const remainingBalance = Math.max(0, numPrice - numInitial);

  // Automatically detect payment status based on initial payment, due date, and purchase price
  let detectedStatus: 'completed' | 'pending' | 'missed' = 'pending';
  if (numPrice > 0 && remainingBalance === 0 && numInitial > 0) {
    detectedStatus = 'completed';
  } else if (paymentDeadline && remainingBalance > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(paymentDeadline);
    deadline.setHours(0, 0, 0, 0);
    if (deadline.getTime() < today.getTime()) {
      detectedStatus = 'missed';
    } else {
      detectedStatus = 'pending';
    }
  } else {
    detectedStatus = 'pending';
  }

  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);

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
        setError('Failed to upload file');
      } finally {
        setIsUploadingDoc(false);
      }
    }
  };

  const handleAddDocument = () => {
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
      setError('Please select or upload a document file to attach');
      return;
    }

    setDocuments([
      ...documents,
      {
        d_name: title,
        d_link: docFileUrl || `/uploads/${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      }
    ]);

    setDocTypePreset('Sale Deed');
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

    if (!selectedType) {
      setError('Please select a property type');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a property name');
      return;
    }
    if (!location.trim()) {
      setError('Please enter property location');
      return;
    }
    if (!purchasePrice || isNaN(numPrice) || numPrice <= 0) {
      setError('Please enter a valid purchase price in ₹');
      return;
    }
    if (numInitial > numPrice) {
      setError('Initial payment cannot exceed the total purchase price');
      return;
    }
    if (!partyName.trim()) {
      setError('Please enter seller / party name from whom the property was purchased');
      return;
    }
    if (isUploadingDoc) {
      setError('Please wait for the document file to finish uploading before saving');
      return;
    }

    // Auto-include any pending document from the upload box even if user didn't click "Attach Document"
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

    const created = addProperty(
      {
        p_type: selectedType,
        name: name.trim(),
        location: location.trim(),
        area_sqft: areaSqft.trim() || undefined,
        purchase_price: numPrice,
        party_name: partyName.trim(),
        party_contact: partyContact.trim(),
        purchase_date: purchaseDate,
        p_notes: notes.trim(),
        initial_payment: numInitial,
        payment_deadline: paymentDeadline || undefined
      },
      finalDocs.length > 0 ? finalDocs : undefined
    );

    onShowToast(`Property "${created.name}" created successfully`, 'success');
    navigate(`/real-estate/${created.p_id}`);
  };

  return (
    <div className="page-container fade-in" style={{ maxWidth: '780px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/real-estate')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ChevronLeft size={16} />
          <span>Back to Real Estate</span>
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Add New Property
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Record property acquisition with initial payment and payment deadline
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-danger" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* 1. Property Type Selector */}
        <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)' }}>
          <label className="form-label" style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'block' }}>
            Property Type *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {(['LAND', 'COMMERCIAL_PROPERTY', 'PRIVATE_PROPERTIES'] as PropertyType[]).map((type) => {
              const cfg = PROPERTY_TYPE_CONFIG[type] || PROPERTY_TYPE_CONFIG['PRIVATE_HOUSE'];
              const isSelected = selectedType === type;
              return (
                <div
                  key={type}
                  onClick={() => setSelectedType(type)}
                  role="button"
                  tabIndex={0}
                  style={{
                    cursor: 'pointer',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${isSelected ? cfg.color : 'var(--border-light)'}`,
                    background: isSelected ? cfg.bgColor : 'var(--bg-surface)',
                    transition: 'all 0.15s ease',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>{cfg.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? cfg.color : 'var(--text-primary)' }}>
                    {cfg.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Property Basic Information */}
        <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} color="var(--color-primary)" />
            <span>Property Information</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Property Name *
              </label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="e.g. Green Valley Farm, Sector 62 Office, Sunrise Villa"
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Location / Address *
              </label>
              <input
                type="text"
                className="form-input"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setError('');
                }}
                placeholder="e.g. Plot #42, Sector 14, Gurgaon, Haryana"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.1fr', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Total Purchase Price (₹) *
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={purchasePrice}
                  onChange={(e) => {
                    setPurchasePrice(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. 4500000"
                  required
                  min="1"
                />
                {numPrice > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                    ₹ {formatCurrency(numPrice)}
                  </span>
                )}
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Area (Sq.ft)
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={areaSqft}
                  onChange={(e) => setAreaSqft(e.target.value)}
                  placeholder="e.g. 1500"
                  min="0"
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                  Property size in Sq.ft
                </span>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Purchase Date *
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                  Flexible for any past year
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Initial Payment & Deadline (Auto-detects status) */}
        <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={18} color="var(--color-primary)" />
              <span>Initial Payment & Deadline</span>
            </h2>

            {/* Live Detected Payment Status Badge */}
            {numPrice > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  background:
                    detectedStatus === 'completed'
                      ? '#DCFCE7'
                      : detectedStatus === 'missed'
                      ? '#FEE2E2'
                      : '#EFF6FF',
                  color:
                    detectedStatus === 'completed'
                      ? '#15803D'
                      : detectedStatus === 'missed'
                      ? '#991B1B'
                      : '#1E40AF',
                  border: `1px solid ${
                    detectedStatus === 'completed'
                      ? '#86EFAC'
                      : detectedStatus === 'missed'
                      ? '#FCA5A5'
                      : '#BFDBFE'
                  }`
                }}
              >
                {detectedStatus === 'completed' && <CheckCircle2 size={12} />}
                {detectedStatus === 'missed' && <AlertCircle size={12} />}
                {detectedStatus === 'pending' && <Clock size={12} />}
                <span>
                  Status: {detectedStatus.toUpperCase()}
                  {detectedStatus === 'completed' && ' (Fully Paid)'}
                  {detectedStatus === 'missed' && ' (Deadline Passed)'}
                  {detectedStatus === 'pending' && remainingBalance > 0 && ` (₹ ${formatCurrency(remainingBalance)} due)`}
                </span>
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                  Initial Payment Made (₹)
                </label>
                {numPrice > 0 && (
                  <button
                    type="button"
                    onClick={() => setInitialPayment(String(numPrice))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Paid 100% upfront
                  </button>
                )}
              </div>
              <input
                type="number"
                className="form-input"
                value={initialPayment}
                onChange={(e) => {
                  setInitialPayment(e.target.value);
                  setError('');
                }}
                placeholder="e.g. 1000000 (or leave 0 if full unpaid)"
                min="0"
                max={numPrice || undefined}
              />
              {numInitial > 0 && (
                <span style={{ fontSize: '11px', color: '#16A34A', display: 'block', marginTop: '3px', fontWeight: 600 }}>
                  Paid: ₹ {formatCurrency(numInitial)} ({numPrice > 0 ? ((numInitial / numPrice) * 100).toFixed(0) : 0}%)
                </span>
              )}
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Full Payment Deadline {remainingBalance > 0 ? `(to pay ₹ ${formatCurrency(remainingBalance)} full money)` : ''}
              </label>
              <input
                type="date"
                className="form-input"
                value={paymentDeadline}
                onChange={(e) => setPaymentDeadline(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: paymentDeadline ? 'var(--color-primary)' : 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                {paymentDeadline
                  ? `Agreed deadline for full property payment: ${formatDate(paymentDeadline)}`
                  : 'Flexible: enter past or upcoming deadline, or leave empty if already settled'}
              </span>
            </div>
          </div>

          {/* Quick breakdown summary */}
          {numPrice > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                padding: '10px 14px',
                background: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Value: </span>
                <strong style={{ color: 'var(--text-primary)' }}>₹ {formatCurrency(numPrice)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Initial Paid: </span>
                <strong style={{ color: '#16A34A' }}>₹ {formatCurrency(numInitial)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Balance Left: </span>
                <strong style={{ color: remainingBalance > 0 ? '#DC2626' : '#16A34A' }}>
                  ₹ {formatCurrency(remainingBalance)}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* 4. Seller / Party Details */}
        <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
            Seller / Party Details
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Seller / Party Name *
              </label>
              <input
                type="text"
                className="form-input"
                value={partyName}
                onChange={(e) => {
                  setPartyName(e.target.value);
                  setError('');
                }}
                placeholder="e.g. Sharma Builders / Anand Rao"
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
                Party Contact Details
              </label>
              <input
                type="text"
                className="form-input"
                value={partyContact}
                onChange={(e) => setPartyContact(e.target.value)}
                placeholder="+91 98765 43210 / contact@builder.com"
              />
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Notes
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Purchased directly from original owner, registry done, khata transfer in progress"
            />
          </div>
        </div>

        {/* 5. Property Documents */}
        <div className="card-panel" style={{ padding: '22px 24px', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            Property Documents
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            Attach ownership title deeds, registration papers, or sale agreements. You can attach multiple documents.
          </p>

          {/* Existing added docs */}
          {documents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {documents.map((doc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {doc.d_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-subtle btn-sm"
                    onClick={() => handleRemoveDoc(idx)}
                    style={{ color: '#DC2626', padding: '4px' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Doc Form */}
          <div style={{ background: 'var(--bg-surface-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: docTypePreset === 'Other Document' ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
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
                    placeholder="Enter document name (e.g. Society NOC, Electricity Sanction)"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Dedicated Document Upload Area */}
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                Upload Document File (PDF, PNG, JPG, WebP)
              </label>
              <div
                style={{
                  border: '2px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-surface)',
                  cursor: isUploadingDoc ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  if (!isUploadingDoc) {
                    document.getElementById('property-doc-upload-input')?.click();
                  }
                }}
              >
                <input
                  id="property-doc-upload-input"
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                  disabled={isUploadingDoc}
                />
                {isUploadingDoc ? (
                  <Loader2 size={22} className="spin" style={{ margin: '0 auto 6px', color: 'var(--color-primary)' }} />
                ) : (
                  <Upload size={22} style={{ margin: '0 auto 6px', color: 'var(--color-primary)' }} />
                )}
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isUploadingDoc ? (
                    <span>Uploading file, please wait...</span>
                  ) : docFileName ? (
                    <span style={{ color: '#16A34A' }}>✓ Selected: {docFileName}</span>
                  ) : (
                    'Click to select or drop document file'
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  PDF, PNG, JPG or WebP up to 8MB
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddDocument}
                disabled={isUploadingDoc}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} />
                <span>Attach Another Document</span>
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Tip: The selected document will be automatically saved when you click "Save Property".
              </span>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/real-estate')}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>
            <Check size={16} />
            <span>Save Property</span>
          </button>
        </div>
      </form>
    </div>
  );
};
