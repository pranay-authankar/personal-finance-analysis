import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { PostOfficeSchemeType } from '../types';
import { formatCurrency } from '../utils/calculations';
import {
  SCHEME_METADATA,
  calculateMISMonthlyPayout,
  calculateSCSSQuarterlyPayout,
  calculateRDMaturity,
  calculateKVPMaturity,
  calculateMahilaSammanMaturity,
  getDefaultMaturityDateForScheme
} from '../utils/postOfficeCalculations';
import {
  ChevronLeft,
  Save,
  Upload,
  X,
  CheckCircle2
} from 'lucide-react';

interface AddPostOfficePageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const SCHEME_KEYS: PostOfficeSchemeType[] = [
  'MIS',
  'SCSS',
  'POTD',
  'RD',
  'PPF',
  'MAHILA_SAMMAN',
  'SUKANYA',
  'NSC',
  'KVP'
];

export const AddPostOfficePage: React.FC<AddPostOfficePageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { activeMember, addOrUpdatePostOffice, getPostOfficeById } = useInvestments();

  // Selected scheme
  const [selectedScheme, setSelectedScheme] = useState<PostOfficeSchemeType>('MIS');

  // Common form fields
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState<number | ''>(200000);
  const [interestRate, setInterestRate] = useState<number | ''>(7.40);
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().split('T')[0];
  });
  const [branch, setBranch] = useState('Head Post Office');
  const [nominee, setNominee] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // Scheme-specific states
  const [monthlyInstallment, setMonthlyInstallment] = useState<number | ''>(5000); // RD
  const [tenureYears, setTenureYears] = useState<number>(5); // POTD
  const [financialYearContribution, setFinancialYearContribution] = useState<number | ''>(150000); // PPF
  const [girlChildName, setGirlChildName] = useState(''); // Sukanya
  const [girlChildDob, setGirlChildDob] = useState(''); // Sukanya
  const [guardianName, setGuardianName] = useState(activeMember?.name || ''); // Sukanya

  // Load existing for edit
  useEffect(() => {
    if (editId) {
      const existing = getPostOfficeById(editId);
      if (existing) {
        setSelectedScheme(existing.schemeType);
        setAccountNumber(existing.accountNumber);
        setAmount(existing.amount);
        setInterestRate(existing.interestRate !== undefined ? existing.interestRate : '');
        setOpeningDate(existing.openingDate);
        setMaturityDate(existing.maturityDate);
        setBranch(existing.branch || 'Head Post Office');
        setNominee(existing.nominee || '');
        setPhotoUrl(existing.photoUrl || '');

        if (existing.monthlyInstallment) setMonthlyInstallment(existing.monthlyInstallment);
        if (existing.tenureYears) setTenureYears(existing.tenureYears);
        if (existing.financialYearContribution) setFinancialYearContribution(existing.financialYearContribution);
        if (existing.girlChildName) setGirlChildName(existing.girlChildName);
        if (existing.girlChildDob) setGirlChildDob(existing.girlChildDob);
        if (existing.guardianName) setGuardianName(existing.guardianName);
      }
    }
  }, [editId, getPostOfficeById]);

  // When user switches scheme in Add Mode, auto-populate standard rate & default maturity
  const handleSchemeChange = (scheme: PostOfficeSchemeType) => {
    setSelectedScheme(scheme);
    const meta = SCHEME_METADATA[scheme];
    setInterestRate(meta.defaultRate);

    const calculatedMatDate = getDefaultMaturityDateForScheme(scheme, openingDate);
    setMaturityDate(calculatedMatDate);

    if (scheme === 'RD' && (!amount || amount === 200000)) {
      setAmount(60000); // 12 mos x 5000
    }
  };

  // Re-calculate maturity date when opening date changes
  const handleOpeningDateChange = (newDate: string) => {
    setOpeningDate(newDate);
    if (!editId) {
      setMaturityDate(getDefaultMaturityDateForScheme(selectedScheme, newDate));
    }
  };

  // Live Calculations
  const calculatedMisMonthly = calculateMISMonthlyPayout(Number(amount) || 0, Number(interestRate) || 0);
  const calculatedScssQuarterly = calculateSCSSQuarterlyPayout(Number(amount) || 0, Number(interestRate) || 0);
  const calculatedRd = calculateRDMaturity(Number(monthlyInstallment) || 0, Number(interestRate) || 6.70);
  const calculatedKvp = calculateKVPMaturity(Number(amount) || 0);
  const calculatedMahila = calculateMahilaSammanMaturity(Number(amount) || 0, Number(interestRate) || 7.50);

  // Photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onShowToast('Document size should be under 5MB.', 'warn');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target?.result as string);
        onShowToast('Post Office passbook / certificate attached.', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      onShowToast('Please specify a valid deposit or investment amount.', 'warn');
      return;
    }
    if (!openingDate || !maturityDate) {
      onShowToast('Please provide both opening and maturity dates.', 'warn');
      return;
    }
    if (new Date(maturityDate) <= new Date(openingDate)) {
      onShowToast('Maturity date must be after opening date.', 'warn');
      return;
    }

    const meta = SCHEME_METADATA[selectedScheme];

    // Compute scheme-specific payout values
    let monthlyPayout: number | undefined;
    let quarterlyPayout: number | undefined;
    let maturityAmount: number | undefined;

    if (selectedScheme === 'MIS') {
      monthlyPayout = calculatedMisMonthly;
      maturityAmount = Number(amount);
    } else if (selectedScheme === 'SCSS') {
      quarterlyPayout = calculatedScssQuarterly;
      maturityAmount = Number(amount);
    } else if (selectedScheme === 'RD') {
      maturityAmount = calculatedRd.maturityAmount;
    } else if (selectedScheme === 'KVP') {
      maturityAmount = calculatedKvp.maturityAmount;
    } else if (selectedScheme === 'MAHILA_SAMMAN') {
      maturityAmount = calculatedMahila.maturityAmount;
    }

    const saved = addOrUpdatePostOffice({
      id: editId || undefined,
      schemeType: selectedScheme,
      schemeName: meta.name,
      accountNumber: accountNumber.trim() || `PO-${selectedScheme}-${Math.floor(10000 + Math.random() * 90000)}`,
      amount: Number(amount),
      interestRate: interestRate !== '' ? Number(interestRate) : undefined,
      openingDate,
      maturityDate,
      branch: branch.trim() || 'Head Post Office',
      nominee: nominee.trim() || undefined,
      photoUrl,
      monthlyPayout,
      quarterlyPayout,
      maturityAmount,
      monthlyInstallment: selectedScheme === 'RD' ? (Number(monthlyInstallment) || undefined) : undefined,
      tenureYears: selectedScheme === 'POTD' ? tenureYears : undefined,
      financialYearContribution: selectedScheme === 'PPF' ? (Number(financialYearContribution) || undefined) : undefined,
      currentBalance: selectedScheme === 'PPF' || selectedScheme === 'SUKANYA' ? Number(amount) : undefined,
      girlChildName: selectedScheme === 'SUKANYA' ? girlChildName.trim() : undefined,
      girlChildDob: selectedScheme === 'SUKANYA' ? girlChildDob : undefined,
      guardianName: selectedScheme === 'SUKANYA' ? guardianName.trim() : undefined
    });

    onShowToast(
      editId ? 'Post Office record updated successfully!' : `Added ${meta.shortName} for ${activeMember?.name}!`,
      'success'
    );
    navigate(`/post-office/${saved.id}`);
  };

  const meta = SCHEME_METADATA[selectedScheme];

  return (
    <div className="main-content fade-in">
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <nav className="breadcrumb-nav">
          <span className="breadcrumb-link" onClick={() => navigate('/home')}>
            Portfolio Overview
          </span>
          <span>/</span>
          <span className="breadcrumb-link" onClick={() => navigate('/post-office')}>
            Post Office Schemes
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {editId ? 'Edit Investment' : 'Add Investment'}
          </span>
        </nav>
      </div>

      <div className="form-page-container">
        <div className="form-page-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editId ? `Edit ${meta.shortName}` : 'Add Post Office Investment'}
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Recording for <strong>{activeMember?.name}</strong> ({activeMember?.role})
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/post-office')}
            >
              <ChevronLeft size={16} />
              <span>Cancel</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* STEP 1: SCHEME SELECTOR (Tiles) */}
            <div style={{ marginBottom: '28px' }}>
              <label className="form-label" style={{ marginBottom: '10px' }}>
                <span>1. Select Post Office Scheme *</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Choose any of the 9 official schemes</span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
                {SCHEME_KEYS.map((key) => {
                  const sMeta = SCHEME_METADATA[key];
                  const isSelected = selectedScheme === key;

                  return (
                    <div
                      key={key}
                      onClick={() => handleSchemeChange(key)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-light)',
                        background: isSelected ? '#EFF6FF' : 'var(--bg-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px' }}>{sMeta.icon}</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                            {sMeta.shortName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Govt Rate: {sMeta.defaultRate}%
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={18} color="var(--brand-primary)" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: DYNAMIC SCHEME-SPECIFIC FIELDS */}
            <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>{meta.icon}</span>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>{meta.name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{meta.description}</p>
                </div>
              </div>

              {/* Account Number & Branch */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="poAccNoInput" className="form-label">
                    <span>Account / Certificate / Passbook No.</span>
                  </label>
                  <input
                    id="poAccNoInput"
                    type="text"
                    className="form-input"
                    placeholder={`e.g. PO-${selectedScheme}-88102`}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="poBranchInput" className="form-label">
                    <span>Post Office / Branch</span>
                  </label>
                  <input
                    id="poBranchInput"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Civil Lines Head Post Office"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>
              </div>

              {/* Scheme-Specific: RD Monthly Installment */}
              {selectedScheme === 'RD' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label htmlFor="rdMonthlyInput" className="form-label">
                      <span>Monthly Installment (₹) *</span>
                    </label>
                    <input
                      id="rdMonthlyInput"
                      type="number"
                      required
                      min={100}
                      step={500}
                      className="form-input"
                      placeholder="5000"
                      value={monthlyInstallment}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setMonthlyInstallment(val);
                        if (val) setAmount(Number(val) * 12); // default current deposit
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rdTotalInput" className="form-label">
                      <span>Total Deposited Balance so far (₹) *</span>
                    </label>
                    <input
                      id="rdTotalInput"
                      type="number"
                      required
                      min={100}
                      step={1000}
                      className="form-input"
                      placeholder="60000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>
                </div>
              )}

              {/* Scheme-Specific: POTD (Time Deposit) Tenure Buttons */}
              {selectedScheme === 'POTD' && (
                <div className="form-group">
                  <label className="form-label">
                    <span>Select Time Deposit Tenure *</span>
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[1, 2, 3, 5].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setTenureYears(yr);
                          const d = new Date(openingDate);
                          d.setFullYear(d.getFullYear() + yr);
                          setMaturityDate(d.toISOString().split('T')[0]);
                          if (yr === 1) setInterestRate(6.90);
                          else if (yr === 2) setInterestRate(7.00);
                          else if (yr === 3) setInterestRate(7.10);
                          else if (yr === 5) setInterestRate(7.50);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: 'var(--radius-md)',
                          border: tenureYears === yr ? '2px solid var(--brand-primary)' : '1px solid var(--border-medium)',
                          background: tenureYears === yr ? 'var(--brand-primary-bg)' : 'white',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {yr} {yr === 1 ? 'Year' : 'Years'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scheme-Specific: PPF FY Contribution */}
              {selectedScheme === 'PPF' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label htmlFor="ppfBalanceInput" className="form-label">
                      <span>Current PPF Balance (₹) *</span>
                    </label>
                    <input
                      id="ppfBalanceInput"
                      type="number"
                      required
                      min={500}
                      step={5000}
                      className="form-input"
                      placeholder="450000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="ppfFyContributionInput" className="form-label">
                      <span>Financial Year Contribution (₹)</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Max ₹1.5L / FY</span>
                    </label>
                    <input
                      id="ppfFyContributionInput"
                      type="number"
                      min={0}
                      max={150000}
                      step={5000}
                      className="form-input"
                      placeholder="150000"
                      value={financialYearContribution}
                      onChange={(e) => setFinancialYearContribution(e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>
                </div>
              )}

              {/* Scheme-Specific: Sukanya Samriddhi Girl Child Details */}
              {selectedScheme === 'SUKANYA' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="ssaGirlNameInput" className="form-label">
                      <span>Girl Child's Name *</span>
                    </label>
                    <input
                      id="ssaGirlNameInput"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Ananya Sharma"
                      value={girlChildName}
                      onChange={(e) => setGirlChildName(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="ssaDobInput" className="form-label">
                      <span>Date of Birth</span>
                    </label>
                    <input
                      id="ssaDobInput"
                      type="date"
                      className="form-input"
                      value={girlChildDob}
                      onChange={(e) => setGirlChildDob(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="ssaGuardianInput" className="form-label">
                      <span>Guardian's Name</span>
                    </label>
                    <input
                      id="ssaGuardianInput"
                      type="text"
                      className="form-input"
                      placeholder="Parent / Guardian"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Amount & Interest Rate Row (for general schemes) */}
              {selectedScheme !== 'RD' && selectedScheme !== 'PPF' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label htmlFor="poAmountInput" className="form-label">
                      <span>
                        {selectedScheme === 'SUKANYA' ? 'Total Amount Deposited (₹) *' : 'Investment / Deposit Amount (₹) *'}
                      </span>
                    </label>
                    <input
                      id="poAmountInput"
                      type="number"
                      required
                      min={1000}
                      step={5000}
                      className="form-input"
                      placeholder="200000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    />
                    <div className="chips-row">
                      <button type="button" className="calc-chip" onClick={() => setAmount(100000)}>
                        ₹1,00,000
                      </button>
                      <button type="button" className="calc-chip" onClick={() => setAmount(250000)}>
                        ₹2,50,000
                      </button>
                      <button type="button" className="calc-chip" onClick={() => setAmount(500000)}>
                        ₹5,00,000
                      </button>
                      {selectedScheme === 'MIS' && (
                        <button type="button" className="calc-chip" onClick={() => setAmount(900000)}>
                          ₹9L (Max Single)
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="poRateInput" className="form-label">
                      <span>Interest Rate (% p.a.) *</span>
                    </label>
                    <input
                      id="poRateInput"
                      type="number"
                      required
                      min={1}
                      max={20}
                      step={0.05}
                      className="form-input"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value ? Number(e.target.value) : '')}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Standard govt rate: {meta.defaultRate}% p.a.
                    </div>
                  </div>
                </div>
              )}

              {/* Opening Date & Maturity Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="poOpenDateInput" className="form-label">
                    <span>Opening / Purchase Date *</span>
                  </label>
                  <input
                    id="poOpenDateInput"
                    type="date"
                    required
                    className="form-input"
                    value={openingDate}
                    onChange={(e) => handleOpeningDateChange(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="poMatDateInput" className="form-label">
                    <span>Maturity Date *</span>
                  </label>
                  <input
                    id="poMatDateInput"
                    type="date"
                    required
                    className="form-input"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Nominee details (Optional) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="poNomineeInput" className="form-label">
                  <span>Registered Nominee (Optional)</span>
                </label>
                <input
                  id="poNomineeInput"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sunita Sharma (Spouse) or Pranav Sharma (Son)"
                  value={nominee}
                  onChange={(e) => setNominee(e.target.value)}
                />
              </div>
            </div>

            {/* LIVE CALCULATION BENEFIT PREVIEWS */}
            <div className="calc-preview-card" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
              {selectedScheme === 'MIS' ? (
                <>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Monthly Guaranteed Income</span>
                    <span className="calc-preview-val gain" style={{ fontSize: '20px' }}>
                      ₹ {formatCurrency(calculatedMisMonthly)} / month
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Total Annual Income</span>
                    <span className="calc-preview-val highlight">
                      ₹ {formatCurrency(calculatedMisMonthly * 12)} / year
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Principal at Maturity</span>
                    <span className="calc-preview-val">₹ {formatCurrency(Number(amount) || 0)}</span>
                  </div>
                </>
              ) : selectedScheme === 'SCSS' ? (
                <>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Quarterly Senior Benefit</span>
                    <span className="calc-preview-val gain" style={{ fontSize: '20px' }}>
                      ₹ {formatCurrency(calculatedScssQuarterly)} / quarter
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Total Annual Return</span>
                    <span className="calc-preview-val highlight">
                      ₹ {formatCurrency(calculatedScssQuarterly * 4)} / year
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Deposit Returned</span>
                    <span className="calc-preview-val">₹ {formatCurrency(Number(amount) || 0)}</span>
                  </div>
                </>
              ) : selectedScheme === 'RD' ? (
                <>
                  <div className="calc-preview-item">
                    <span className="val-kicker">5-Year Total Investment</span>
                    <span className="calc-preview-val">
                      ₹ {formatCurrency(calculatedRd.totalDeposited)}
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Compounded Interest Gain</span>
                    <span className="calc-preview-val gain">
                      +₹ {formatCurrency(calculatedRd.interestEarned)}
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Estimated Maturity Payout</span>
                    <span className="calc-preview-val highlight" style={{ fontSize: '20px' }}>
                      ₹ {formatCurrency(calculatedRd.maturityAmount)}
                    </span>
                  </div>
                </>
              ) : selectedScheme === 'KVP' ? (
                <>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Purchase Amount</span>
                    <span className="calc-preview-val">₹ {formatCurrency(Number(amount) || 0)}</span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Guaranteed Doubling</span>
                    <span className="calc-preview-val gain">
                      +₹ {formatCurrency(Number(amount) || 0)} (100% Profit)
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Maturity Value at 115 Mos</span>
                    <span className="calc-preview-val highlight" style={{ fontSize: '20px' }}>
                      ₹ {formatCurrency(calculatedKvp.maturityAmount)}
                    </span>
                  </div>
                </>
              ) : selectedScheme === 'MAHILA_SAMMAN' ? (
                <>
                  <div className="calc-preview-item">
                    <span className="val-kicker">2-Year Deposit</span>
                    <span className="calc-preview-val">₹ {formatCurrency(Number(amount) || 0)}</span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Guaranteed Return (7.5%)</span>
                    <span className="calc-preview-val gain">
                      +₹ {formatCurrency(calculatedMahila.interestEarned)}
                    </span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Estimated Maturity Value</span>
                    <span className="calc-preview-val highlight" style={{ fontSize: '20px' }}>
                      ₹ {formatCurrency(calculatedMahila.maturityAmount)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Sovereign Protection</span>
                    <span className="calc-preview-val gain">100% Govt Backed</span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Annual Interest</span>
                    <span className="calc-preview-val highlight">{interestRate}% p.a.</span>
                  </div>
                  <div className="calc-preview-item">
                    <span className="val-kicker">Tax Benefits</span>
                    <span className="calc-preview-val">Section 80C Eligible</span>
                  </div>
                </>
              )}
            </div>

            {/* DOCUMENT / PASSBOOK UPLOAD */}
            <div className="form-group">
              <label className="form-label">
                <span>Upload Passbook / Certificate Document (Optional)</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG, PNG up to 5MB</span>
              </label>

              {photoUrl ? (
                <div className="dropzone-preview">
                  <img src={photoUrl} alt="Document Preview" />
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
                  <Upload size={28} color="#EA580C" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>Click to choose image or drag &amp; drop</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Photo of passbook or certificate stored securely in your local browser sandbox
                  </p>
                </label>
              )}
            </div>

            {/* SUBMIT BUTTONS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/post-office')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ background: '#EA580C', borderColor: '#C2410C' }}
              >
                <Save size={18} />
                <span>{editId ? 'Save Investment Changes' : 'Confirm & Save Post Office Investment'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
