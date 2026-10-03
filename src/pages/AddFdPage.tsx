import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { calculateFDValues, formatCurrency } from '../utils/calculations';
import {
  ChevronLeft,
  Save,
  Upload,
  X
} from 'lucide-react';

interface AddFdPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const POPULAR_BANKS = [
  'State Bank of India (SBI)',
  'HDFC Bank',
  'ICICI Bank',
  'Punjab National Bank (PNB)',
  'Post Office Time Deposit',
  'Axis Bank',
  'Bank of Baroda',
  'Kotak Mahindra Bank'
];

export const AddFdPage: React.FC<AddFdPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { activeMember, addOrUpdateFd, getFdById } = useInvestments();

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [principal, setPrincipal] = useState<number | ''>(500000);
  const [interestRate, setInterestRate] = useState<number | ''>(7.25);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // Load existing FD if editing
  useEffect(() => {
    if (editId) {
      const existing = getFdById(editId);
      if (existing) {
        setBankName(existing.bankName);
        setAccountNumber(existing.accountNumber);
        setPrincipal(existing.principal);
        setInterestRate(existing.interestRate);
        setStartDate(existing.startDate);
        setMaturityDate(existing.maturityDate);
        setPhotoUrl(existing.photoUrl || '');
      }
    }
  }, [editId, getFdById]);

  // Handle Quick Tenure adjustments
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

  // Photo file upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onShowToast('Image size should be under 5MB.', 'warn');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target?.result as string);
        onShowToast('Certificate image attached successfully.', 'success');
      };
      reader.readAsDataURL(file);
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

    const saved = addOrUpdateFd({
      id: editId || undefined,
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim() || `•••• ${Math.floor(1000 + Math.random() * 9000)}`,
      principal: Number(principal),
      interestRate: Number(interestRate),
      startDate,
      maturityDate,
      photoUrl
    });

    onShowToast(
      editId ? 'Fixed deposit updated successfully!' : `Added new FD for ${activeMember?.name}!`,
      'success'
    );
    navigate(`/fds/${saved.id}`);
  };

  return (
    <div className="main-content fade-in">
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <nav className="breadcrumb-nav">
          <span className="breadcrumb-link" onClick={() => navigate('/home')}>
            Portfolio Overview
          </span>
          <span>/</span>
          <span className="breadcrumb-link" onClick={() => navigate('/fds')}>
            Fixed Deposits
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {editId ? 'Edit Fixed Deposit' : 'Add Fixed Deposit'}
          </span>
        </nav>
      </div>

      <div className="form-page-container">
        <div className="form-page-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editId ? 'Edit Fixed Deposit Record' : 'Add New Fixed Deposit'}
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Recording deposit for <strong>{activeMember?.name}</strong> ({activeMember?.role})
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/fds')}
            >
              <ChevronLeft size={16} />
              <span>Cancel</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 1. Bank Name */}
            <div className="form-group">
              <label htmlFor="bankNameInput" className="form-label">
                <span>Bank / Institution Name *</span>
              </label>
              <input
                id="bankNameInput"
                type="text"
                required
                className="form-input"
                placeholder="e.g. State Bank of India, HDFC, Post Office"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <div className="preset-pills-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>
                  Quick presets:
                </span>
                {POPULAR_BANKS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className="preset-pill"
                    onClick={() => setBankName(b)}
                  >
                    {b.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Account Number */}
            <div className="form-group">
              <label htmlFor="accNumberInput" className="form-label">
                <span>Account / FDR Receipt Number (Optional)</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Masked for privacy</span>
              </label>
              <input
                id="accNumberInput"
                type="text"
                className="form-input"
                placeholder="e.g. •••• 8821 or FDR-992144"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>

            {/* 3. Principal Amount & Interest Rate Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="principalInput" className="form-label">
                  <span>Principal Amount (₹) *</span>
                </label>
                <input
                  id="principalInput"
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  className="form-input"
                  placeholder="500000"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="chips-row">
                  <button
                    type="button"
                    className="calc-chip"
                    onClick={() => setPrincipal((prev) => (Number(prev) || 0) + 50000)}
                  >
                    +50,000
                  </button>
                  <button
                    type="button"
                    className="calc-chip"
                    onClick={() => setPrincipal((prev) => (Number(prev) || 0) + 100000)}
                  >
                    +1,00,000
                  </button>
                  <button
                    type="button"
                    className="calc-chip"
                    onClick={() => setPrincipal((prev) => (Number(prev) || 0) + 500000)}
                  >
                    +5,00,000
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="rateInput" className="form-label">
                  <span>Annual Interest Rate (% p.a.) *</span>
                </label>
                <input
                  id="rateInput"
                  type="number"
                  required
                  min={1}
                  max={25}
                  step={0.05}
                  className="form-input"
                  placeholder="7.25"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="chips-row">
                  <button type="button" className="calc-chip" onClick={() => setInterestRate(7.10)}>
                    7.10%
                  </button>
                  <button type="button" className="calc-chip" onClick={() => setInterestRate(7.25)}>
                    7.25%
                  </button>
                  <button type="button" className="calc-chip" onClick={() => setInterestRate(7.50)}>
                    7.50%
                  </button>
                  <button type="button" className="calc-chip" onClick={() => setInterestRate(7.75)}>
                    7.75% (Sr.)
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Dates & Quick Tenure */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                <div className="chips-row">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>
                    Quick tenure:
                  </span>
                  <button type="button" className="calc-chip" onClick={() => applyTenure(6)}>
                    6 Months
                  </button>
                  <button type="button" className="calc-chip" onClick={() => applyTenure(12)}>
                    1 Year
                  </button>
                  <button type="button" className="calc-chip" onClick={() => applyTenure(24)}>
                    2 Years
                  </button>
                  <button type="button" className="calc-chip" onClick={() => applyTenure(36)}>
                    3 Years
                  </button>
                  <button type="button" className="calc-chip" onClick={() => applyTenure(60)}>
                    5 Years
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Live Calculation Preview Card */}
            <div className="calc-preview-card">
              <div className="calc-preview-item">
                <span className="val-kicker">Deposit Tenure</span>
                <span className="calc-preview-val highlight">
                  {previewCalc.tenureFormatted} ({previewCalc.tenureDays}d)
                </span>
              </div>
              <div className="calc-preview-item">
                <span className="val-kicker">Estimated Interest Return</span>
                <span className="calc-preview-val gain">
                  +₹ {formatCurrency(previewCalc.interestEarned)}
                </span>
              </div>
              <div className="calc-preview-item">
                <span className="val-kicker">Estimated Maturity Value</span>
                <span className="calc-preview-val">
                  ₹ {formatCurrency(previewCalc.maturityAmount)}
                </span>
              </div>
            </div>

            {/* 6. Upload Photo / Screenshot */}
            <div className="form-group">
              <label className="form-label">
                <span>Upload FD Certificate / Receipt Document (Optional)</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG, PNG up to 5MB</span>
              </label>

              {photoUrl ? (
                <div className="dropzone-preview">
                  <img src={photoUrl} alt="Certificate Preview" />
                  <button
                    type="button"
                    className="dropzone-remove-btn"
                    onClick={() => setPhotoUrl('')}
                    title="Remove attached photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="photo-dropzone">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                  <Upload size={28} color="var(--brand-primary)" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>Click to choose image or drag &amp; drop</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Photo will be safely stored in your local browser sandbox
                  </p>
                </label>
              )}
            </div>

            {/* Submit Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/fds')}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-lg">
                <Save size={18} />
                <span>{editId ? 'Save FD Changes' : 'Confirm & Save FD'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
