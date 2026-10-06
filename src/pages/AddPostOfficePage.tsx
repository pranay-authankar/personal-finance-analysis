import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { PostOfficeSchemeType } from '../types';
import { formatCurrency, calculateFDValues } from '../utils/calculations';
import { uploadDocumentFile } from '../utils/fileUpload';
import {
  SCHEME_METADATA,
  getTdRateByTenure,
  calculateMISMonthlyPayout,
  calculateSCSSQuarterlyPayout,
  calculateRDMaturity,
  getDefaultMaturityDateForScheme
} from '../utils/postOfficeCalculations';
import {
  ChevronLeft,
  Save,
  Upload,
  X,
  Loader2,
  FileText
} from 'lucide-react';

interface AddPostOfficePageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const AddPostOfficePage: React.FC<AddPostOfficePageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { activeMember, addOrUpdatePostOffice, getPostOfficeById } = useInvestments();

  // Selected scheme — choose TD / MIS / RD / SCSS
  const [selectedScheme, setSelectedScheme] = useState<PostOfficeSchemeType>('TD');

  // Shared inputs
  const [accountNumber, setAccountNumber] = useState('');
  const [interestRate, setInterestRate] = useState<number | ''>(7.50);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().split('T')[0];
  });
  const [actualEndDate, setActualEndDate] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [docTypePreset, setDocTypePreset] = useState<string>('Passbook / Certificate Document');
  const [customDocName, setCustomDocName] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  // Scheme-specific state: TD
  const [tdPrincipal, setTdPrincipal] = useState<number | ''>(100000);
  const [tenureYears, setTenureYears] = useState<number>(5);

  // Scheme-specific state: MIS
  const [misPrincipal, setMisPrincipal] = useState<number | ''>(200000);

  // Scheme-specific state: RD
  const [rdMonthlyDeposit, setRdMonthlyDeposit] = useState<number | ''>(5000);
  const [rdInitialPaidMonths, setRdInitialPaidMonths] = useState<number>(1);

  // Scheme-specific state: SCSS
  const [scssPrincipal, setScssPrincipal] = useState<number | ''>(500000);

  // Load existing for edit
  useEffect(() => {
    if (editId) {
      const existing = getPostOfficeById(editId);
      if (existing) {
        let scheme = existing.schemeType;
        if ((scheme as string) === 'POTD') scheme = 'TD';
        setSelectedScheme(scheme);
        setAccountNumber(existing.accountNumber || '');
        setInterestRate(existing.interestRate !== undefined ? existing.interestRate : '');
        setStartDate(existing.openingDate);
        setMaturityDate(existing.maturityDate);
        setActualEndDate(existing.actualEndDate || '');
        setPhotoUrl(existing.photoUrl || '');
        if (existing.photoDocName) {
          setDocTypePreset(existing.photoDocName);
        }

        if (scheme === 'TD') {
          setTdPrincipal(existing.amount || 100000);
          if (existing.tenureYears) setTenureYears(existing.tenureYears);
        } else if (scheme === 'MIS') {
          setMisPrincipal(existing.amount || 200000);
        } else if (scheme === 'RD') {
          setRdMonthlyDeposit(existing.monthlyDeposit || existing.monthlyInstallment || 5000);
        } else if (scheme === 'SCSS') {
          setScssPrincipal(existing.amount || 500000);
        }
      }
    }
  }, [editId, getPostOfficeById]);

  // Handle scheme selection
  const handleSchemeSelect = (scheme: PostOfficeSchemeType) => {
    setSelectedScheme(scheme);
    const meta = SCHEME_METADATA[scheme];

    if (scheme === 'TD') {
      const rate = getTdRateByTenure(tenureYears);
      setInterestRate(rate);
      setMaturityDate(getDefaultMaturityDateForScheme('TD', startDate, tenureYears));
    } else {
      setInterestRate(meta.defaultRate);
      setMaturityDate(getDefaultMaturityDateForScheme(scheme, startDate, 5));
    }
  };

  // When start date changes
  const handleStartDateChange = (newDate: string) => {
    setStartDate(newDate);
    if (!editId) {
      if (selectedScheme === 'TD') {
        setMaturityDate(getDefaultMaturityDateForScheme('TD', newDate, tenureYears));
      } else {
        setMaturityDate(getDefaultMaturityDateForScheme(selectedScheme, newDate, 5));
      }
    }
  };

  // When TD tenure changes
  const handleTenureChange = (years: number) => {
    setTenureYears(years);
    setInterestRate(getTdRateByTenure(years));
    setMaturityDate(getDefaultMaturityDateForScheme('TD', startDate, years));
  };

  // File upload
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

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !maturityDate) {
      onShowToast('Please select valid start and maturity dates.', 'warn');
      return;
    }
    if (new Date(maturityDate) <= new Date(startDate)) {
      onShowToast('Maturity date must be after start date.', 'warn');
      return;
    }

    let depositAmount = 0;
    const meta = SCHEME_METADATA[selectedScheme];

    if (selectedScheme === 'TD') {
      depositAmount = Number(tdPrincipal);
      if (!depositAmount || depositAmount < 1000) {
        onShowToast('Minimum deposit for TD is ₹1,000.', 'warn');
        return;
      }
    } else if (selectedScheme === 'MIS') {
      depositAmount = Number(misPrincipal);
      if (!depositAmount || depositAmount < 1000) {
        onShowToast('Minimum deposit for MIS is ₹1,000.', 'warn');
        return;
      }
      if (depositAmount > 1500000) {
        onShowToast('Maximum deposit for MIS is ₹15,00,000 (joint limit).', 'warn');
        return;
      }
    } else if (selectedScheme === 'RD') {
      const monthly = Number(rdMonthlyDeposit);
      if (!monthly || monthly < 100) {
        onShowToast('Minimum monthly deposit for RD is ₹100.', 'warn');
        return;
      }
      depositAmount = monthly * (Number(rdInitialPaidMonths) || 1);
    } else if (selectedScheme === 'SCSS') {
      depositAmount = Number(scssPrincipal);
      if (!depositAmount || depositAmount < 1000) {
        onShowToast('Minimum deposit for SCSS is ₹1,000.', 'warn');
        return;
      }
      if (depositAmount > 3000000) {
        onShowToast('Maximum deposit for SCSS is ₹30,00,000.', 'warn');
        return;
      }
    }

    const effectiveRate = Number(interestRate) || meta.defaultRate;

    // Derived payouts
    const misPayout = selectedScheme === 'MIS' ? calculateMISMonthlyPayout(depositAmount, effectiveRate) : undefined;
    const scssPayout = selectedScheme === 'SCSS' ? calculateSCSSQuarterlyPayout(depositAmount, effectiveRate) : undefined;
    const rdCalc = selectedScheme === 'RD' ? calculateRDMaturity(Number(rdMonthlyDeposit) || 0, effectiveRate, 60) : undefined;

    addOrUpdatePostOffice({
      id: editId || undefined,
      schemeType: selectedScheme,
      schemeName: meta.name,
      accountNumber: accountNumber.trim() || `PO-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: depositAmount,
      interestRate: effectiveRate,
      openingDate: startDate,
      maturityDate: maturityDate,
      actualEndDate: actualEndDate ? actualEndDate.trim() : undefined,
      photoUrl,
      photoDocName: docTypePreset === 'Other Document' ? customDocName.trim() || 'Other Document' : docTypePreset,
      tenureYears: selectedScheme === 'TD' ? tenureYears : 5,
      monthlyDeposit: selectedScheme === 'RD' ? Number(rdMonthlyDeposit) : undefined,
      monthlyPayout: misPayout,
      quarterlyPayout: scssPayout,
      maturityAmount: rdCalc ? rdCalc.maturityAmount : undefined,
      initialPaidMonths: selectedScheme === 'RD' && !editId ? Number(rdInitialPaidMonths) || 1 : undefined
    });

    onShowToast(
      editId
        ? 'Post Office scheme updated successfully!'
        : `Added ${meta.shortName} for ${activeMember?.name || 'user'}!`,
      'success'
    );
    navigate('/post-office');
  };

  // Live calculation previews
  const tdPreview = calculateFDValues(Number(tdPrincipal) || 0, Number(interestRate) || 7.5, startDate, maturityDate);
  const misMonthlyGain = calculateMISMonthlyPayout(Number(misPrincipal) || 0, Number(interestRate) || 7.4);
  const scssQuarterlyGain = calculateSCSSQuarterlyPayout(Number(scssPrincipal) || 0, Number(interestRate) || 8.2);
  const rdPreview = calculateRDMaturity(Number(rdMonthlyDeposit) || 0, Number(interestRate) || 6.7, 60);

  return (
    <div className="main-content fade-in" style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/post-office')}
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
          <span>Back to Post Office</span>
        </button>
      </div>

      <div className="po-form-card">
        {/* Header */}
        <div className="po-form-header">
          <h1 className="po-form-title">
            {editId ? 'Edit Post Office Scheme' : 'Add Post Office Scheme'}
          </h1>
          <p className="po-form-subtitle">
            {activeMember?.name ? `Recording for ${activeMember.name}` : 'Select scheme and enter details'}
          </p>
        </div>

        {/* STEP 1: Choose TD / MIS / RD / SCSS */}
        {!editId && (
          <div className="po-scheme-picker-container">
            <span className="po-form-section-title">Select Scheme Type</span>
            <div className="po-scheme-picker-grid">
              {[
                { type: 'TD' as const, label: 'Time Deposit (TD)', sub: '1-5 Yr Term Deposit' },
                { type: 'MIS' as const, label: 'Monthly Income (MIS)', sub: 'Monthly Pension' },
                { type: 'RD' as const, label: 'Recurring Deposit (RD)', sub: 'Monthly Savings' },
                { type: 'SCSS' as const, label: 'Senior Citizens (SCSS)', sub: 'Quarterly Payout' }
              ].map((s) => (
                <button
                  key={s.type}
                  type="button"
                  className={`po-scheme-choice-btn ${selectedScheme === s.type ? 'active' : ''}`}
                  onClick={() => handleSchemeSelect(s.type)}
                >
                  <span className="po-scheme-choice-name">{s.label}</span>
                  <span className="po-scheme-choice-sub">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Show ONLY fields required for that chosen scheme */}
        <form onSubmit={handleSubmit} className="po-form-body">
          {/* Account Number (common to all) */}
          <div className="form-group">
            <label htmlFor="poAccInput" className="form-label">
              <span>Account / Certificate Number (Optional)</span>
            </label>
            <input
              id="poAccInput"
              type="text"
              className="form-input"
              placeholder="e.g. 10294829104"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

          {/* SCHEME 1: TD ONLY FIELDS */}
          {selectedScheme === 'TD' && (
            <div className="po-form-group-section">
              <span className="po-form-section-title">Time Deposit (TD) Terms</span>

              <div className="form-group">
                <label htmlFor="tdPrincipalInput" className="form-label">
                  <span>Deposit Amount (₹) *</span>
                </label>
                <input
                  id="tdPrincipalInput"
                  type="number"
                  required
                  min={1000}
                  step="any"
                  className="form-input"
                  placeholder="100000"
                  value={tdPrincipal}
                  onChange={(e) => setTdPrincipal(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="po-chips-row">
                  {[50000, 100000, 250000, 500000].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="po-chip-btn"
                      onClick={() => setTdPrincipal(chip)}
                    >
                      ₹{chip >= 100000 ? `${chip / 100000}L` : `${chip / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* TD Tenure Options */}
              <div className="form-group">
                <label className="form-label">
                  <span>Tenure Duration &amp; Government Rate</span>
                </label>
                <div className="po-tenure-grid">
                  {[
                    { yrs: 1, rate: 6.90 },
                    { yrs: 2, rate: 7.00 },
                    { yrs: 3, rate: 7.10 },
                    { yrs: 5, rate: 7.50 }
                  ].map((t) => (
                    <button
                      key={t.yrs}
                      type="button"
                      className={`po-tenure-btn ${tenureYears === t.yrs ? 'active' : ''}`}
                      onClick={() => handleTenureChange(t.yrs)}
                    >
                      <span style={{ fontWeight: 700 }}>{t.yrs} {t.yrs === 1 ? 'Year' : 'Years'}</span>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>{t.rate}% p.a.</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="po-form-grid-2">
                <div className="form-group">
                  <label htmlFor="tdStartInput" className="form-label">
                    <span>Start Date *</span>
                  </label>
                  <input
                    id="tdStartInput"
                    type="date"
                    required
                    className="form-input"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tdMatInput" className="form-label">
                    <span>Maturity Date *</span>
                  </label>
                  <input
                    id="tdMatInput"
                    type="date"
                    required
                    className="form-input"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                  />
                </div>
              </div>

              {/* TD Preview */}
              <div className="po-calc-preview-bar">
                <div>
                  <span className="po-calc-kicker">Deposit</span>
                  <span className="po-calc-val">₹ {formatCurrency(Number(tdPrincipal) || 0)}</span>
                </div>
                <div>
                  <span className="po-calc-kicker">Est. Profit</span>
                  <span className="po-calc-val" style={{ color: '#059669' }}>
                    +₹ {formatCurrency(tdPreview.interestEarned)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="po-calc-kicker">Maturity Return</span>
                  <span className="po-calc-val">₹ {formatCurrency(tdPreview.maturityAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* SCHEME 2: MIS ONLY FIELDS */}
          {selectedScheme === 'MIS' && (
            <div className="po-form-group-section">
              <span className="po-form-section-title">Monthly Income Scheme (MIS) Terms</span>

              <div className="form-group">
                <label htmlFor="misPrincipalInput" className="form-label">
                  <span>Deposit Amount (₹) *</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Max ₹9L Single / ₹15L Joint</span>
                </label>
                <input
                  id="misPrincipalInput"
                  type="number"
                  required
                  min={1000}
                  max={1500000}
                  step="any"
                  className="form-input"
                  placeholder="200000"
                  value={misPrincipal}
                  onChange={(e) => setMisPrincipal(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="po-chips-row">
                  {[100000, 450000, 900000, 1500000].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="po-chip-btn"
                      onClick={() => setMisPrincipal(chip)}
                    >
                      ₹{chip >= 100000 ? `${chip / 100000}L` : `${chip / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interest Rate & Dates */}
              <div className="po-form-grid-2">
                <div className="form-group">
                  <label htmlFor="misRateInput" className="form-label">
                    <span>Govt. Rate (% p.a.) *</span>
                  </label>
                  <input
                    id="misRateInput"
                    type="number"
                    required
                    step="any"
                    className="form-input"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="misStartInput" className="form-label">
                    <span>Start Date *</span>
                  </label>
                  <input
                    id="misStartInput"
                    type="date"
                    required
                    className="form-input"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="misMatInput" className="form-label">
                  <span>Maturity Date (5-Year Tenure) *</span>
                </label>
                <input
                  id="misMatInput"
                  type="date"
                  required
                  className="form-input"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                />
              </div>

              {/* MIS Prominent Monthly Income Preview */}
              <div className="po-income-highlight-card emerald" style={{ margin: 0 }}>
                <span className="po-income-highlight-kicker">Calculated Monthly Income</span>
                <div className="po-income-highlight-value">
                  ₹ {formatCurrency(misMonthlyGain)}
                  <span className="po-income-highlight-unit">/ month</span>
                </div>
                <span className="po-income-highlight-sub">
                  Full principal ₹{formatCurrency(Number(misPrincipal) || 0)} refunded at maturity
                </span>
              </div>
            </div>
          )}

          {/* SCHEME 3: RD ONLY FIELDS */}
          {selectedScheme === 'RD' && (
            <div className="po-form-group-section">
              <span className="po-form-section-title">Recurring Deposit (RD) Terms</span>

              <div className="form-group">
                <label htmlFor="rdMonthlyInput" className="form-label">
                  <span>Monthly Deposit (₹) *</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Min ₹100 / month</span>
                </label>
                <input
                  id="rdMonthlyInput"
                  type="number"
                  required
                  min={100}
                  step="any"
                  className="form-input"
                  placeholder="5000"
                  value={rdMonthlyDeposit}
                  onChange={(e) => setRdMonthlyDeposit(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="po-chips-row">
                  {[1000, 2500, 5000, 10000].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="po-chip-btn"
                      onClick={() => setRdMonthlyDeposit(chip)}
                    >
                      ₹{chip >= 1000 ? `${chip / 1000}k` : chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="po-form-grid-2">
                <div className="form-group">
                  <label htmlFor="rdRateInput" className="form-label">
                    <span>Govt. Rate (% p.a.) *</span>
                  </label>
                  <input
                    id="rdRateInput"
                    type="number"
                    required
                    step="any"
                    className="form-input"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>

                {!editId && (
                  <div className="form-group">
                    <label htmlFor="rdInstallmentInput" className="form-label">
                      <span>Installments Paid So Far</span>
                    </label>
                    <input
                      id="rdInstallmentInput"
                      type="number"
                      min={1}
                      max={60}
                      className="form-input"
                      value={rdInitialPaidMonths}
                      onChange={(e) => setRdInitialPaidMonths(Number(e.target.value) || 1)}
                    />
                  </div>
                )}
              </div>

              <div className="po-form-grid-2">
                <div className="form-group">
                  <label htmlFor="rdStartInput" className="form-label">
                    <span>Opening Date *</span>
                  </label>
                  <input
                    id="rdStartInput"
                    type="date"
                    required
                    className="form-input"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="rdMatInput" className="form-label">
                    <span>Maturity Date (60 Months) *</span>
                  </label>
                  <input
                    id="rdMatInput"
                    type="date"
                    required
                    className="form-input"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                  />
                </div>
              </div>

              {/* RD Live Maturity Preview */}
              <div className="po-calc-preview-bar">
                <div>
                  <span className="po-calc-kicker">Total To Deposit</span>
                  <span className="po-calc-val">₹ {formatCurrency(rdPreview.totalDeposited)}</span>
                </div>
                <div>
                  <span className="po-calc-kicker">Est. Profit</span>
                  <span className="po-calc-val" style={{ color: '#059669' }}>
                    +₹ {formatCurrency(rdPreview.interestEarned)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="po-calc-kicker">Maturity Value</span>
                  <span className="po-calc-val">₹ {formatCurrency(rdPreview.maturityAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* SCHEME 4: SCSS ONLY FIELDS */}
          {selectedScheme === 'SCSS' && (
            <div className="po-form-group-section">
              <span className="po-form-section-title">Senior Citizens Savings Scheme (SCSS) Terms</span>

              <div className="form-group">
                <label htmlFor="scssPrincipalInput" className="form-label">
                  <span>Deposit Amount (₹) *</span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Max ₹30,00,000</span>
                </label>
                <input
                  id="scssPrincipalInput"
                  type="number"
                  required
                  min={1000}
                  max={3000000}
                  step="any"
                  className="form-input"
                  placeholder="500000"
                  value={scssPrincipal}
                  onChange={(e) => setScssPrincipal(e.target.value ? Number(e.target.value) : '')}
                />
                <div className="po-chips-row">
                  {[500000, 1000000, 1500000, 3000000].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="po-chip-btn"
                      onClick={() => setScssPrincipal(chip)}
                    >
                      ₹{chip >= 100000 ? `${chip / 100000}L` : `${chip / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="po-form-grid-2">
                <div className="form-group">
                  <label htmlFor="scssRateInput" className="form-label">
                    <span>Govt. Rate (% p.a.) *</span>
                  </label>
                  <input
                    id="scssRateInput"
                    type="number"
                    required
                    step="any"
                    className="form-input"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="scssStartInput" className="form-label">
                    <span>Start Date *</span>
                  </label>
                  <input
                    id="scssStartInput"
                    type="date"
                    required
                    className="form-input"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="scssMatInput" className="form-label">
                  <span>Maturity Date (5-Year Tenure) *</span>
                </label>
                <input
                  id="scssMatInput"
                  type="date"
                  required
                  className="form-input"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                />
              </div>

              {/* SCSS Prominent Quarterly Income Preview */}
              <div className="po-income-highlight-card gold" style={{ margin: 0 }}>
                <span className="po-income-highlight-kicker">Quarterly Pension Payout</span>
                <div className="po-income-highlight-value">
                  ₹ {formatCurrency(scssQuarterlyGain)}
                  <span className="po-income-highlight-unit">/ quarter</span>
                </div>
                <span className="po-income-highlight-sub">
                  Credited at the end of each quarter (Mar, Jun, Sep, Dec)
                </span>
              </div>
            </div>
          )}

          {/* Optional Actual End Date */}
          <div className="form-group">
            <label htmlFor="poActualEndInput" className="form-label">
              <span>Actual End Date (Optional - if already closed / redeemed)</span>
            </label>
            <input
              id="poActualEndInput"
              type="date"
              className="form-input"
              value={actualEndDate}
              onChange={(e) => setActualEndDate(e.target.value)}
            />
          </div>

          {/* Optional Document Upload */}
          <div className="po-form-group-section">
            <span className="po-form-section-title">Passbook / Document (Optional)</span>

            <div className="form-group">
              <label htmlFor="poDocSelect" className="form-label">
                <span>Document Type</span>
              </label>
              <select
                id="poDocSelect"
                className="form-input"
                value={docTypePreset}
                onChange={(e) => setDocTypePreset(e.target.value)}
              >
                <option value="Passbook / Certificate Document">Passbook / Certificate Document</option>
                <option value="Deposit Receipt">Deposit Receipt</option>
                <option value="Account Opening Form">Account Opening Form</option>
                <option value="Other Document">Other Document</option>
              </select>
            </div>

            {docTypePreset === 'Other Document' && (
              <div className="form-group">
                <label htmlFor="poCustomDocInput" className="form-label">
                  <span>Document Name</span>
                </label>
                <input
                  id="poCustomDocInput"
                  type="text"
                  className="form-input"
                  value={customDocName}
                  onChange={(e) => setCustomDocName(e.target.value)}
                  placeholder="e.g. Passbook Front Page"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <span>Upload File (PDF, PNG, JPG)</span>
              </label>

              {photoUrl ? (
                <div className="po-doc-attached-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={18} color="#059669" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                      {docTypePreset === 'Other Document' ? customDocName || 'Document' : docTypePreset}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="po-doc-remove-btn"
                    onClick={() => setPhotoUrl('')}
                    title="Remove document"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <label className="po-doc-dropzone">
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
          <div className="po-form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/post-office')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#0F172A', borderColor: '#0F172A' }}
            >
              <Save size={16} />
              <span>{editId ? 'Save Scheme Changes' : 'Save Scheme'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
