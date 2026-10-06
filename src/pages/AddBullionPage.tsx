import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { getBullionMetadata, WEIGHT_UNIT_OPTIONS, convertToGrams } from '../utils/bullionCalculations';
import { getDeadlineClassification } from '../utils/deadlinesColorMap';
import { formatCurrency } from '../utils/calculations';
import { uploadDocumentFile } from '../utils/fileUpload';
import {
  ChevronLeft,
  Save,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';

interface AddBullionPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const QUICK_BULLION_SUGGESTIONS = [
  '24K Gold Bar',
  '22K Gold Jewellery',
  'Silver Bar (999)',
  'Silver Coin',
  'Platinum 950',
  'Diamond Solitaire'
];

export const AddBullionPage: React.FC<AddBullionPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { activeMember, addOrUpdateBullion, getBullionById } = useInvestments();

  // Form Fields
  const [type, setType] = useState<string>('Gold 24K');
  const [itemName, setItemName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [purchaseRate, setPurchaseRate] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [weightUnit, setWeightUnit] = useState<string>('g');
  const [weightDisplay, setWeightDisplay] = useState<string>('');
  const [investedValue, setInvestedValue] = useState<number | ''>('');
  const [initialPayment, setInitialPayment] = useState<number | ''>('');
  const [paymentDueDate, setPaymentDueDate] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Load existing for edit
  useEffect(() => {
    if (editId) {
      const existing = getBullionById(editId);
      if (existing) {
        setType(existing.typeName || existing.type || 'Gold 24K');
        setItemName(existing.itemName);
        setPurchaseDate(existing.purchaseDate || '');
        setPurchaseRate(existing.purchaseRate !== undefined ? existing.purchaseRate : '');
        setWeight(
          existing.weight !== undefined
            ? existing.weight
            : (existing.weightGrams !== undefined ? existing.weightGrams : '')
        );
        setWeightUnit(existing.weightUnit || 'g');
        setWeightDisplay(existing.weightDisplay || '');
        setInvestedValue(existing.investedValue !== undefined ? existing.investedValue : '');
        setInitialPayment(existing.initialPayment !== undefined ? existing.initialPayment : '');
        setPaymentDueDate(existing.paymentDueDate || '');
        setPhotoUrl(existing.photoUrl || '');
        setNotes(existing.notes || '');
      }
    }
  }, [editId, getBullionById]);

  // Auto calculate suggested value when rate & weight change
  const handleAutoCalcValue = () => {
    if (weight && purchaseRate && Number(weight) > 0 && Number(purchaseRate) > 0) {
      const calculated = Math.round(Number(weight) * Number(purchaseRate));
      setInvestedValue(calculated);
      onShowToast(`Calculated total value: ₹${formatCurrency(calculated)}`, 'info');
    }
  };

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onShowToast('Receipt image size should be under 5MB.', 'warn');
        return;
      }
      const uploadedUrl = await uploadDocumentFile(file);
      if (uploadedUrl) {
        setPhotoUrl(uploadedUrl);
        onShowToast('Receipt / certificate attached.', 'success');
      }
    }
  };

  const selectedUnitOption =
    WEIGHT_UNIT_OPTIONS.find((u) => u.id === weightUnit) || WEIGHT_UNIT_OPTIONS[0];

  const isValueProvided =
    (investedValue !== '' && Number(investedValue) > 0) ||
    (weight !== '' && purchaseRate !== '' && Number(weight) > 0 && Number(purchaseRate) > 0);

  const numWeight = Number(weight) || 0;
  const numRate = Number(purchaseRate) || 0;
  const numInvested =
    Number(investedValue) || (numWeight > 0 && numRate > 0 ? Math.round(numWeight * numRate) : 0);
  const numInitial = initialPayment !== '' ? Number(initialPayment) : numInvested;
  const remainingBalance = Math.max(0, numInvested - numInitial);
  const deadlineClass = paymentDueDate ? getDeadlineClassification(paymentDueDate) : null;
  const currentMeta = getBullionMetadata(type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedType = type.trim();
    if (!trimmedType) {
      onShowToast('Please enter the bullion type.', 'warn');
      return;
    }

    const defaultLabel = itemName.trim() || `${trimmedType} Holding`;
    const computedWeightDisplay =
      weight !== '' ? `${weight} ${selectedUnitOption.shortLabel}` : weightDisplay.trim();
    const computedGrams = weight !== '' ? convertToGrams(Number(weight), weightUnit) : undefined;

    const saved = addOrUpdateBullion({
      id: editId || undefined,
      type: trimmedType,
      typeName: trimmedType,
      itemName: defaultLabel,
      purchaseDate: purchaseDate || undefined,
      purchaseRate: purchaseRate !== '' ? Number(purchaseRate) : undefined,
      weight: weight !== '' ? Number(weight) : undefined,
      weightUnit,
      weightGrams: computedGrams,
      weightDisplay: computedWeightDisplay || undefined,
      investedValue:
        investedValue !== ''
          ? Number(investedValue)
          : (numWeight > 0 && numRate > 0 ? Math.round(numWeight * numRate) : undefined),
      initialPayment: initialPayment !== '' ? Number(initialPayment) : undefined,
      paymentDueDate: paymentDueDate || undefined,
      photoUrl,
      notes: notes.trim() || undefined
    });

    if (isValueProvided) {
      onShowToast(editId ? 'Bullion asset updated!' : `Added ${defaultLabel} to vault!`, 'success');
    } else {
      onShowToast(`Added ${defaultLabel} (Marked: Needs verification soon)`, 'info');
    }

    navigate(`/bullions/${saved.id}`);
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
          <span className="breadcrumb-link" onClick={() => navigate('/bullions')}>
            Bullions
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {editId ? 'Edit Bullion Holding' : 'Add Bullion Asset'}
          </span>
        </nav>
      </div>

      <div className="form-page-container">
        <div className="form-page-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              paddingBottom: '18px',
              borderBottom: '1px solid var(--border-light)'
            }}
          >
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editId ? 'Edit Bullion Holding' : 'Add Bullion Investment'}
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Recording for <strong>{activeMember?.name}</strong> ({activeMember?.role})
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/bullions')}
            >
              <ChevronLeft size={16} />
              <span>Cancel</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 1. Bullion Type: User-typed Custom Input (No Pre-decided Buttons) */}
            <div className="form-group">
              <label htmlFor="bullionTypeInput" className="form-label" style={{ marginBottom: '6px' }}>
                <span>Type of Bullion / Metal * (Mandatory)</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Enter your bullion type freely
                </span>
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  id="bullionTypeInput"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. 24K Gold Bar, 22K Gold Jewellery, Silver Coin, Platinum Bar, Diamond Solitaire..."
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  style={{ fontSize: '15px', fontWeight: 600, paddingLeft: '44px' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '20px'
                  }}
                >
                  {currentMeta.icon}
                </span>
              </div>

              {/* Quick suggestion chips for convenience */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                  Quick Suggestions:
                </span>
                {QUICK_BULLION_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    className="calc-chip"
                    onClick={() => {
                      setType(sug);
                      if (!itemName) setItemName(`${sug} Holding`);
                    }}
                    style={{
                      background: type === sug ? '#FEF3C7' : undefined,
                      borderColor: type === sug ? '#F59E0B' : undefined,
                      color: type === sug ? '#92400E' : undefined,
                      fontWeight: type === sug ? 700 : undefined
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Holding / Item Name (Optional) */}
            <div className="form-group">
              <label htmlFor="bullionNameInput" className="form-label">
                <span>Holding / Description (Optional)</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  e.g. "Tanishq 24K 50g Gold Bar", "Silver Puja Coins"
                </span>
              </label>
              <input
                id="bullionNameInput"
                type="text"
                className="form-input"
                placeholder={`e.g. ${type || 'Bullion'} Holding`}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>

            {/* 3. Weight / Quantity & Rate in Rupees */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="bullionWeightInput" className="form-label" style={{ marginBottom: '6px' }}>
                  <span>Weight &amp; Unit of Weight (Optional)</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Choose any unit: mg, g, kg, pounds...
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="bullionWeightInput"
                    type="number"
                    min={0}
                    step="any"
                    className="form-input"
                    placeholder="e.g. 50, 1.5, 250"
                    value={weight}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : '';
                      setWeight(val);
                      if (val && !weightDisplay) setWeightDisplay(`${val} ${selectedUnitOption.shortLabel}`);
                    }}
                    style={{ flex: 1 }}
                  />
                  <select
                    id="bullionWeightUnitSelect"
                    className="form-input"
                    value={weightUnit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setWeightUnit(newUnit);
                      if (weight) setWeightDisplay(`${weight} ${newUnit}`);
                    }}
                    style={{ width: '135px', fontWeight: 600, background: 'var(--bg-surface)' }}
                  >
                    {WEIGHT_UNIT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Unit Selection Chips */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>Unit:</span>
                  {WEIGHT_UNIT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="calc-chip"
                      onClick={() => {
                        setWeightUnit(opt.id);
                        if (weight) setWeightDisplay(`${weight} ${opt.shortLabel}`);
                      }}
                      style={{
                        background: weightUnit === opt.id ? 'var(--brand-primary)' : undefined,
                        color: weightUnit === opt.id ? '#FFFFFF' : undefined,
                        borderColor: weightUnit === opt.id ? 'var(--brand-primary)' : undefined,
                        fontWeight: weightUnit === opt.id ? 700 : undefined,
                        padding: '2px 8px',
                        fontSize: '11px'
                      }}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>

                {/* Dynamic Quick Weight Presets based on chosen unit */}
                <div className="chips-row" style={{ marginTop: '8px' }}>
                  {weightUnit === 'g' && (
                    <>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(10); setWeightDisplay('10 g'); }}>10g</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(50); setWeightDisplay('50 g'); }}>50g</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(100); setWeightDisplay('100 g'); }}>100g</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(1000); setWeightDisplay('1000 g'); }}>1000g</button>
                    </>
                  )}
                  {weightUnit === 'kg' && (
                    <>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(0.25); setWeightDisplay('0.25 kg'); }}>0.25 kg</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(0.5); setWeightDisplay('0.5 kg'); }}>0.5 kg</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(1); setWeightDisplay('1 kg'); }}>1 kg</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(2); setWeightDisplay('2 kg'); }}>2 kg</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(5); setWeightDisplay('5 kg'); }}>5 kg</button>
                    </>
                  )}
                  {weightUnit === 'mg' && (
                    <>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(100); setWeightDisplay('100 mg'); }}>100 mg</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(250); setWeightDisplay('250 mg'); }}>250 mg</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(500); setWeightDisplay('500 mg'); }}>500 mg</button>
                    </>
                  )}
                  {weightUnit === 'pounds' && (
                    <>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(0.5); setWeightDisplay('0.5 lbs'); }}>0.5 lb</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(1); setWeightDisplay('1 lb'); }}>1 lb</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(2); setWeightDisplay('2 lbs'); }}>2 lbs</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(5); setWeightDisplay('5 lbs'); }}>5 lbs</button>
                    </>
                  )}
                  {weightUnit === 'tola' && (
                    <>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(1); setWeightDisplay('1 tola'); }}>1 tola</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(5); setWeightDisplay('5 tolas'); }}>5 tolas</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(10); setWeightDisplay('10 tolas'); }}>10 tolas</button>
                    </>
                  )}
                  {weightUnit === 'oz' && (
                    <>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(0.5); setWeightDisplay('0.5 oz'); }}>0.5 oz</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(1); setWeightDisplay('1 oz'); }}>1 oz</button>
                      <button type="button" className="calc-chip" onClick={() => { setWeight(5); setWeightDisplay('5 oz'); }}>5 oz</button>
                    </>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="bullionRateInput" className="form-label" style={{ marginBottom: '6px' }}>
                  <span>Rate / Price in Rupees (₹) (Optional)</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ₹ in Rupees {weightUnit ? `per ${selectedUnitOption.shortLabel}` : ''}
                  </span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontWeight: 700,
                      color: 'var(--text-muted)'
                    }}
                  >
                    ₹
                  </span>
                  <input
                    id="bullionRateInput"
                    type="number"
                    min={0}
                    step="any"
                    className="form-input"
                    placeholder={weightUnit === 'kg' ? 'e.g. 92000' : 'e.g. 7500'}
                    value={purchaseRate}
                    onChange={(e) => setPurchaseRate(e.target.value ? Number(e.target.value) : '')}
                    style={{ paddingLeft: '28px' }}
                  />
                </div>

                {weight && purchaseRate && (
                  <button
                    type="button"
                    onClick={handleAutoCalcValue}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-primary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginTop: '6px',
                      display: 'block'
                    }}
                  >
                    ⚡ Calculate Total Value ({weight} {selectedUnitOption.shortLabel} × ₹{purchaseRate} = ₹{formatCurrency(Math.round(Number(weight) * Number(purchaseRate)))})
                  </button>
                )}
              </div>
            </div>

            {/* 4. Total Invested Value & Purchase Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="bullionValueInput" className="form-label">
                  <span>Total Purchase / Invested Value (₹) (Optional)</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Acquisition cost</span>
                </label>
                <input
                  id="bullionValueInput"
                  type="number"
                  min={0}
                  step="any"
                  className="form-input"
                  placeholder="e.g. 340000"
                  value={investedValue}
                  onChange={(e) => setInvestedValue(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="bullionDateInput" className="form-label">
                  <span>Purchase / Acquisition Date (Optional)</span>
                </label>
                <input
                  id="bullionDateInput"
                  type="date"
                  className="form-input"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            {/* 5. Initial Payment & Full Payment Due Date (with Urgency Colour Map) */}
            <div
              style={{
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                background: 'var(--bg-surface-subtle)',
                marginBottom: '20px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Payment &amp; Due Date Details
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Track initial down-payment paid and full balance payment due date
                  </p>
                </div>

                {deadlineClass && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: deadlineClass.bgTint,
                      border: `1px solid ${deadlineClass.borderTint}`,
                      color: deadlineClass.textDark
                    }}
                  >
                    {deadlineClass.isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
                    <span>
                      {deadlineClass.label}: {deadlineClass.relativeText}
                    </span>
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="bullionInitialPaymentInput" className="form-label">
                    <span>Initial Payment / Down Payment (₹) (Optional)</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Amount paid at purchase
                    </span>
                  </label>
                  <input
                    id="bullionInitialPaymentInput"
                    type="number"
                    min={0}
                    step="any"
                    className="form-input"
                    placeholder="e.g. 50000 (leave blank if full value was paid)"
                    value={initialPayment}
                    onChange={(e) =>
                      setInitialPayment(e.target.value ? Number(e.target.value) : '')
                    }
                  />
                  {remainingBalance > 0 && initialPayment !== '' && (
                    <div style={{ fontSize: '12px', color: '#B45309', fontWeight: 600, marginTop: '5px' }}>
                      Remaining Balance Due: ₹ {formatCurrency(remainingBalance)}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="bullionDueDateInput" className="form-label">
                    <span>Full Payment Due Date (Optional)</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Latest deadline for payment
                    </span>
                  </label>
                  <input
                    id="bullionDueDateInput"
                    type="date"
                    className="form-input"
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                    style={{
                      borderColor: deadlineClass ? deadlineClass.borderTint : undefined,
                      background: deadlineClass ? deadlineClass.bgTint : undefined
                    }}
                  />
                  {paymentDueDate && deadlineClass && (
                    <div
                      style={{
                        fontSize: '11px',
                        marginTop: '5px',
                        color: deadlineClass.textDark,
                        fontWeight: 600
                      }}
                    >
                      Urgency Level {deadlineClass.level}: {deadlineClass.relativeText}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Incomplete Record Warning / Status Callout */}
            {!isValueProvided ? (
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#92400E'
                }}
              >
                <AlertCircle size={20} color="#B45309" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '13px' }}>
                  <strong>Note: Value info is currently omitted.</strong>
                  <div style={{ marginTop: '2px', color: '#B45309' }}>
                    This entry will be saved with the status <strong>"Needs verification soon"</strong>. It will be excluded from your total portfolio valuation until purchase value or weight &amp; rate is supplied.
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#065F46',
                  fontSize: '13px'
                }}
              >
                <CheckCircle2 size={18} color="#059669" />
                <span>
                  <strong>Verified Value:</strong> Recorded value of ₹
                  {formatCurrency(numInvested)} will be included in the Bullions total and asset allocation chart.
                </span>
              </div>
            )}

            {/* 6. Notes / Hallmark Details (Optional) */}
            <div className="form-group">
              <label htmlFor="bullionNotesInput" className="form-label">
                <span>Notes, Purity &amp; Hallmarking (Optional)</span>
              </label>
              <textarea
                id="bullionNotesInput"
                className="form-input"
                rows={2}
                placeholder="e.g. BIS 916 Hallmark, stored in safe deposit locker, assay certificate attached"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* 7. Receipt / Certificate Upload (Optional) */}
            <div className="form-group">
              <label className="form-label">
                <span>Upload Invoice / Certificate / Photo of Holding (Optional)</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG, PNG up to 5MB</span>
              </label>

              {photoUrl ? (
                <div className="dropzone-preview">
                  <img src={photoUrl} alt="Receipt Preview" />
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
                  <Upload size={28} color="#D97706" style={{ margin: '0 auto 8px', display: 'block' }} />
                  <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>
                    Click to upload invoice or drag &amp; drop
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Receipt photo is safely stored in your local browser sandbox
                  </p>
                </label>
              )}
            </div>

            {/* Submit Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border-light)'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/bullions')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ background: '#D97706', borderColor: '#B45309' }}
              >
                <Save size={18} />
                <span>{editId ? 'Save Bullion Changes' : 'Confirm & Save Bullion Asset'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
