import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { calculateFDValues, formatCurrency } from '../utils/calculations';
import { uploadDocumentFile } from '../utils/fileUpload';
import {
  ChevronLeft,
  Save,
  Upload,
  X,
  Loader2,
  FileText
} from 'lucide-react';

interface AddFdPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const FD_BANKS_STORAGE_KEY = 'familyvault_saved_fd_banks';

const loadSavedBanks = (): string[] => {
  try {
    const raw = localStorage.getItem(FD_BANKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const AddFdPage: React.FC<AddFdPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { activeMember, addOrUpdateFd, getFdById } = useInvestments();

  const [bankName, setBankName] = useState('');
  const [savedBanks, setSavedBanks] = useState<string[]>(() => loadSavedBanks());
  const [showDropdown, setShowDropdown] = useState(false);

  const [accountNumber, setAccountNumber] = useState('');
  const [principal, setPrincipal] = useState<number | ''>(500000);
  const [interestRate, setInterestRate] = useState<number | ''>(7.25);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [actualEndDate, setActualEndDate] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [docTypePreset, setDocTypePreset] = useState<string>('FD Certificate / Receipt');
  const [customDocName, setCustomDocName] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  const saveBankToMemory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const current = loadSavedBanks();
      const filtered = current.filter((b) => b.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered];
      localStorage.setItem(FD_BANKS_STORAGE_KEY, JSON.stringify(updated));
      setSavedBanks(updated);
    } catch (e) {
      console.error('Failed to save bank name to memory', e);
    }
  };

  const removeBankFromMemory = (nameToRemove: string) => {
    try {
      const current = loadSavedBanks();
      const updated = current.filter((b) => b.toLowerCase() !== nameToRemove.toLowerCase());
      localStorage.setItem(FD_BANKS_STORAGE_KEY, JSON.stringify(updated));
      setSavedBanks(updated);
    } catch (e) {
      console.error('Failed to remove bank name from memory', e);
    }
  };

  const matchingSavedBanks = useMemo(() => {
    if (!bankName.trim()) return savedBanks;
    const q = bankName.toLowerCase().trim();
    return savedBanks.filter((b) => b.toLowerCase().includes(q));
  }, [bankName, savedBanks]);

  // Load existing FD if editing
  useEffect(() => {
    if (editId) {
      const existing = getFdById(editId);
      if (existing) {
        setBankName(existing.bankName);
        setAccountNumber(existing.accountNumber || '');
        setPrincipal(existing.principal);
        setInterestRate(existing.interestRate);
        setStartDate(existing.startDate);
        setMaturityDate(existing.maturityDate);
        setActualEndDate(existing.actualEndDate || '');
        setPhotoUrl(existing.photoUrl || '');
        if (existing.photoDocName) {
          setDocTypePreset(existing.photoDocName);
        }
      }
    }
  }, [editId, getFdById]);

  // Quick tenure helper
  const applyTenure = (monthsCount: number) => {
    const start = startDate ? new Date(startDate) : new Date();
    const mat = new Date(start);
    mat.setMonth(mat.getMonth() + monthsCount);
    setMaturityDate(mat.toISOString().split('T')[0]);
  };

  // Live calculation preview
  const previewCalc = calculateFDValues(
    Number(principal) || 0,
    Number(interestRate) || 0,
    startDate,
    maturityDate
  );

  // File upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        onShowToast('Document size should be under 8MB.', 'warn');
        return;
      }
      setIsUploadingPhoto(true);
      try {
        const uploadedUrl = await uploadDocumentFile(file);
        if (uploadedUrl) {
          setPhotoUrl(uploadedUrl);
          onShowToast('Document attached successfully.', 'success');
        }
      } catch {
        onShowToast('Failed to upload document file.', 'warn');
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName.trim()) {
      onShowToast('Please specify the Bank or Institution name.', 'warn');
      return;
    }
    if (!principal || Number(principal) <= 0) {
      onShowToast('Please enter a valid principal deposit amount.', 'warn');
      return;
    }
    if (!interestRate || Number(interestRate) <= 0) {
      onShowToast('Please enter an annual interest rate %.', 'warn');
      return;
    }
    if (!startDate || !maturityDate) {
      onShowToast('Please select both deposit start and maturity dates.', 'warn');
      return;
    }
    if (new Date(maturityDate) <= new Date(startDate)) {
      onShowToast('Maturity date must be after deposit start date.', 'warn');
      return;
    }
    if (isUploadingPhoto) {
      onShowToast('Please wait for the document to finish uploading.', 'warn');
      return;
    }

    const trimmedBank = bankName.trim();
    saveBankToMemory(trimmedBank);

    addOrUpdateFd({
      id: editId || undefined,
      bankName: trimmedBank,
      accountNumber: accountNumber.trim(),
      principal: Number(principal),
      interestRate: Number(interestRate),
      startDate,
      maturityDate,
      actualEndDate: actualEndDate ? actualEndDate.trim() : undefined,
      photoUrl,
      photoDocName: docTypePreset === 'Other Document' ? customDocName.trim() || 'Other Document' : docTypePreset
    });

    onShowToast(
      editId ? 'Fixed deposit updated successfully!' : `Added new FD for ${activeMember?.name || 'user'}!`,
      'success'
    );
    navigate(`/fds`);
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/fds')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <ChevronLeft size={16} />
          <span>Back to Fixed Deposits</span>
        </button>
      </div>

      <div className="fd-form-card">
        {/* Form Header */}
        <div className="fd-form-header">
          <div>
            <h1 className="fd-form-title">
              {editId ? 'Edit Fixed Deposit' : 'Add Fixed Deposit'}
            </h1>
            <p className="fd-form-subtitle">
              {activeMember?.name ? `Recording for ${activeMember.name}` : 'Enter deposit details'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="fd-form-body">
          {/* GROUP 1: Bank & Account Details */}
          <div className="fd-form-group-section">
            <h2 className="fd-form-section-title">1. Bank &amp; Account</h2>

            {/* Bank Name */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="bankNameInput" className="form-label">
                <span>Bank / Institution Name *</span>
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  id="bankNameInput"
                  type="text"
                  required
                  autoComplete="off"
                  list="fd-bank-suggestions"
                  className="form-input"
                  placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
                  value={bankName}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                />

                <datalist id="fd-bank-suggestions">
                  {savedBanks.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>

                {showDropdown && matchingSavedBanks.length > 0 && (
                  <div className="fd-bank-dropdown">
                    {matchingSavedBanks.map((b) => (
                      <div
                        key={b}
                        className="fd-bank-dropdown-item"
                        onMouseDown={() => {
                          setBankName(b);
                          setShowDropdown(false);
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{b}</span>
                        <button
                          type="button"
                          className="fd-bank-remove-btn"
                          title="Remove from saved memory"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBankFromMemory(b);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Account Number */}
            <div className="form-group">
              <label htmlFor="accNumberInput" className="form-label">
                <span>Account / FDR Receipt Number (Optional)</span>
              </label>
              <input
                id="accNumberInput"
                type="text"
                className="form-input"
                placeholder="e.g. 50100482914 or FDR-992144"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
          </div>

          {/* GROUP 2: Financial Terms & Timeline */}
          <div className="fd-form-group-section">
            <h2 className="fd-form-section-title">2. Financial Terms &amp; Schedule</h2>

            {/* Principal & Interest Rate */}
            <div className="fd-form-grid-2">
              <div className="form-group">
                <label htmlFor="principalInput" className="form-label">
                  <span>Principal (₹) *</span>
                </label>
                <input
                  id="principalInput"
                  type="number"
                  required
                  min={1}
                  step="any"
                  className="form-input"
                  placeholder="500000"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="fd-chips-row">
                  <button
                    type="button"
                    className="fd-chip-btn"
                    onClick={() => setPrincipal((prev) => (Number(prev) || 0) + 50000)}
                  >
                    +50k
                  </button>
                  <button
                    type="button"
                    className="fd-chip-btn"
                    onClick={() => setPrincipal((prev) => (Number(prev) || 0) + 100000)}
                  >
                    +1L
                  </button>
                  <button
                    type="button"
                    className="fd-chip-btn"
                    onClick={() => setPrincipal((prev) => (Number(prev) || 0) + 500000)}
                  >
                    +5L
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="rateInput" className="form-label">
                  <span>Interest Rate (% p.a.) *</span>
                </label>
                <input
                  id="rateInput"
                  type="number"
                  required
                  min={0.01}
                  max={30}
                  step="any"
                  className="form-input"
                  placeholder="7.25"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="fd-chips-row">
                  <button type="button" className="fd-chip-btn" onClick={() => setInterestRate(7.10)}>
                    7.10%
                  </button>
                  <button type="button" className="fd-chip-btn" onClick={() => setInterestRate(7.25)}>
                    7.25%
                  </button>
                  <button type="button" className="fd-chip-btn" onClick={() => setInterestRate(7.50)}>
                    7.50%
                  </button>
                  <button type="button" className="fd-chip-btn" onClick={() => setInterestRate(7.75)}>
                    7.75%
                  </button>
                </div>
              </div>
            </div>

            {/* Start & Maturity Date */}
            <div className="fd-form-grid-2">
              <div className="form-group">
                <label htmlFor="startDateInput" className="form-label">
                  <span>Start Date *</span>
                </label>
                <input
                  id="startDateInput"
                  type="date"
                  required
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="maturityDateInput" className="form-label">
                  <span>Maturity Date *</span>
                </label>
                <input
                  id="maturityDateInput"
                  type="date"
                  required
                  className="form-input"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                />
                <div className="fd-chips-row">
                  <button type="button" className="fd-chip-btn" onClick={() => applyTenure(6)}>
                    6M
                  </button>
                  <button type="button" className="fd-chip-btn" onClick={() => applyTenure(12)}>
                    1Y
                  </button>
                  <button type="button" className="fd-chip-btn" onClick={() => applyTenure(24)}>
                    2Y
                  </button>
                  <button type="button" className="fd-chip-btn" onClick={() => applyTenure(36)}>
                    3Y
                  </button>
                  <button type="button" className="fd-chip-btn" onClick={() => applyTenure(60)}>
                    5Y
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Actual End Date */}
            <div className="form-group">
              <label htmlFor="actualEndDateInput" className="form-label">
                <span>Actual End Date (Optional - if already redeemed / closed)</span>
              </label>
              <input
                id="actualEndDateInput"
                type="date"
                className="form-input"
                value={actualEndDate}
                onChange={(e) => setActualEndDate(e.target.value)}
              />
            </div>

            {/* Compact Live Yield Summary */}
            <div className="fd-calc-preview-bar">
              <div>
                <span className="fd-calc-preview-kicker">Tenure</span>
                <span className="fd-calc-preview-val">
                  {previewCalc.tenureFormatted}
                </span>
              </div>
              <div>
                <span className="fd-calc-preview-kicker">Est. Gain</span>
                <span className="fd-calc-preview-val" style={{ color: '#059669' }}>
                  +₹ {formatCurrency(previewCalc.interestEarned)}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="fd-calc-preview-kicker">Maturity Value</span>
                <span className="fd-calc-preview-val" style={{ color: '#0F172A' }}>
                  ₹ {formatCurrency(previewCalc.maturityAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* GROUP 3: Document / Certificate (Optional) */}
          <div className="fd-form-group-section">
            <h2 className="fd-form-section-title">3. Document (Optional)</h2>

            <div className="form-group">
              <label htmlFor="docTypeSelect" className="form-label">
                <span>Document Type</span>
              </label>
              <select
                id="docTypeSelect"
                className="form-input"
                value={docTypePreset}
                onChange={(e) => setDocTypePreset(e.target.value)}
              >
                <option value="FD Certificate / Receipt">FD Certificate / Receipt</option>
                <option value="Fixed Deposit Advice">Fixed Deposit Advice</option>
                <option value="Bank Passbook Copy">Bank Passbook Copy</option>
                <option value="Form 15G / 15H Acknowledgement">Form 15G / 15H Acknowledgement</option>
                <option value="Other Document">Other Document</option>
              </select>
            </div>

            {docTypePreset === 'Other Document' && (
              <div className="form-group">
                <label htmlFor="customDocNameInput" className="form-label">
                  <span>Document Name</span>
                </label>
                <input
                  id="customDocNameInput"
                  type="text"
                  className="form-input"
                  value={customDocName}
                  onChange={(e) => setCustomDocName(e.target.value)}
                  placeholder="e.g. Renewal Slip"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <span>Upload File (PDF, PNG, JPG)</span>
              </label>

              {photoUrl ? (
                <div className="fd-doc-attached-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={18} color="#059669" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                      {docTypePreset === 'Other Document' ? customDocName || 'Document' : docTypePreset}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="fd-doc-remove-btn"
                    onClick={() => setPhotoUrl('')}
                    title="Remove document"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <label className="fd-doc-dropzone">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    style={{ display: 'none' }}
                  />
                  {isUploadingPhoto ? (
                    <Loader2 size={24} className="spin" color="#0F172A" />
                  ) : (
                    <Upload size={22} color="#64748B" />
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '6px' }}>
                    {isUploadingPhoto ? 'Uploading document...' : 'Click to select document'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                    Max 8MB · Stored securely
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="fd-form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/fds')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#0F172A', borderColor: '#0F172A' }}
            >
              <Save size={16} />
              <span>{editId ? 'Save Changes' : 'Save FD'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
