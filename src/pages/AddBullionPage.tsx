import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { BullionType } from '../types';
import { BULLION_METADATA } from '../utils/bullionCalculations';
import { formatCurrency } from '../utils/calculations';
import {
  ChevronLeft,
  Save,
  Upload,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AddBullionPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const BULLION_TYPES: BullionType[] = ['GOLD', 'SILVER', 'PLATINUM', 'OTHER'];

export const AddBullionPage: React.FC<AddBullionPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { activeMember, addOrUpdateBullion, getBullionById } = useInvestments();

  // Form Fields
  const [type, setType] = useState<BullionType>('GOLD');
  const [itemName, setItemName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [purchaseRate, setPurchaseRate] = useState<number | ''>('');
  const [weightGrams, setWeightGrams] = useState<number | ''>('');
  const [weightDisplay, setWeightDisplay] = useState<string>('');
  const [investedValue, setInvestedValue] = useState<number | ''>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Load existing for edit
  useEffect(() => {
    if (editId) {
      const existing = getBullionById(editId);
      if (existing) {
        setType(existing.type);
        setItemName(existing.itemName);
        setPurchaseDate(existing.purchaseDate || '');
        setPurchaseRate(existing.purchaseRate !== undefined ? existing.purchaseRate : '');
        setWeightGrams(existing.weightGrams !== undefined ? existing.weightGrams : '');
        setWeightDisplay(existing.weightDisplay || '');
        setInvestedValue(existing.investedValue !== undefined ? existing.investedValue : '');
        setPhotoUrl(existing.photoUrl || '');
        setNotes(existing.notes || '');
      }
    }
  }, [editId, getBullionById]);

  // Auto calculate suggested value when rate & weight change
  const handleAutoCalcValue = () => {
    if (weightGrams && purchaseRate && Number(weightGrams) > 0 && Number(purchaseRate) > 0) {
      const calculated = Math.round(Number(weightGrams) * Number(purchaseRate));
      setInvestedValue(calculated);
      onShowToast(`Calculated value: ₹${formatCurrency(calculated)}`, 'info');
    }
  };

  // Photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onShowToast('Receipt image size should be under 5MB.', 'warn');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target?.result as string);
        onShowToast('Receipt / certificate attached.', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const isValueProvided = (investedValue !== '' && Number(investedValue) > 0) ||
    (weightGrams !== '' && purchaseRate !== '' && Number(weightGrams) > 0 && Number(purchaseRate) > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!type) {
      onShowToast('Please select a bullion metal type.', 'warn');
      return;
    }

    const meta = BULLION_METADATA[type];
    const defaultLabel = itemName.trim() || `${meta.name.split(' (')[0]} Holding`;

    const saved = addOrUpdateBullion({
      id: editId || undefined,
      type,
      typeName: meta.name,
      itemName: defaultLabel,
      purchaseDate: purchaseDate || undefined,
      purchaseRate: purchaseRate !== '' ? Number(purchaseRate) : undefined,
      weightGrams: weightGrams !== '' ? Number(weightGrams) : undefined,
      weightDisplay: weightDisplay.trim() || (weightGrams ? `${weightGrams} grams` : undefined),
      investedValue: investedValue !== '' ? Number(investedValue) : undefined,
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

  const currentMeta = BULLION_METADATA[type];

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid var(--border-light)' }}>
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
            {/* 1. Bullion Type Selector (Mandatory) */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '8px' }}>
                <span>Type of Bullion * (Mandatory)</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Select metal category</span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {BULLION_TYPES.map((bType) => {
                  const bMeta = BULLION_METADATA[bType];
                  const isSelected = type === bType;

                  return (
                    <div
                      key={bType}
                      onClick={() => setType(bType)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? `2px solid ${bMeta.color}` : '1px solid var(--border-medium)',
                        background: isSelected ? bMeta.badgeBg : 'var(--bg-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>{bMeta.icon}</span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {bMeta.name.split(' (')[0]}
                          </div>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 size={18} color={bMeta.color} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Holding / Item Name (Optional) */}
            <div className="form-group">
              <label htmlFor="bullionNameInput" className="form-label">
                <span>Holding / Description (Optional)</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>e.g. "Tanishq 24K 50g Gold Bar"</span>
              </label>
              <input
                id="bullionNameInput"
                type="text"
                className="form-input"
                placeholder={`e.g. ${currentMeta.name.split(' (')[0]} Coins / Ingot / Jewellery`}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>

            {/* 3. Weight / Quantity & Rate */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="bullionWeightInput" className="form-label">
                  <span>Weight in Grams (Optional)</span>
                </label>
                <input
                  id="bullionWeightInput"
                  type="number"
                  min={0.1}
                  step={0.1}
                  className="form-input"
                  placeholder="e.g. 50"
                  value={weightGrams}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : '';
                    setWeightGrams(val);
                    if (val && !weightDisplay) setWeightDisplay(`${val} grams`);
                  }}
                />
                <div className="chips-row">
                  <button type="button" className="calc-chip" onClick={() => { setWeightGrams(10); setWeightDisplay('10 grams'); }}>
                    10g
                  </button>
                  <button type="button" className="calc-chip" onClick={() => { setWeightGrams(50); setWeightDisplay('50 grams'); }}>
                    50g
                  </button>
                  <button type="button" className="calc-chip" onClick={() => { setWeightGrams(100); setWeightDisplay('100 grams'); }}>
                    100g
                  </button>
                  <button type="button" className="calc-chip" onClick={() => { setWeightGrams(1000); setWeightDisplay('1 kg'); }}>
                    1 kg
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="bullionRateInput" className="form-label">
                  <span>Purchase Rate / Gram (₹) (Optional)</span>
                </label>
                <input
                  id="bullionRateInput"
                  type="number"
                  min={1}
                  step={10}
                  className="form-input"
                  placeholder="e.g. 6800"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value ? Number(e.target.value) : '')}
                />
                {weightGrams && purchaseRate && (
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
                      marginTop: '4px'
                    }}
                  >
                    ⚡ Calculate Total Value ({weightGrams}g × ₹{purchaseRate}/g)
                  </button>
                )}
              </div>
            </div>

            {/* 4. Total Invested / Purchase Value & Purchase Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="bullionValueInput" className="form-label">
                  <span>Total Purchase / Invested Value (₹) (Optional)</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Acquisition cost</span>
                </label>
                <input
                  id="bullionValueInput"
                  type="number"
                  min={100}
                  step={1000}
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
                    This entry will be saved and displayed with the label <strong>"Needs verification soon"</strong>. It will not be added to your total portfolio valuation until purchase value or weight &amp; rate is supplied.
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
                  <strong>Verified Value:</strong> Recorded value of ₹{formatCurrency(Number(investedValue) || (Number(weightGrams) * Number(purchaseRate)))} will be included in the Bullions total and value distribution chart.
                </span>
              </div>
            )}

            {/* 5. Notes / Hallmark Details (Optional) */}
            <div className="form-group">
              <label htmlFor="bullionNotesInput" className="form-label">
                <span>Notes, Purity &amp; Hallmarking (Optional)</span>
              </label>
              <textarea
                id="bullionNotesInput"
                className="form-input"
                rows={2}
                placeholder="e.g. BIS 916 Hallmark, stored in SBI safe deposit locker #42, assay certificate attached"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* 6. Receipt / Certificate Upload (Optional) */}
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
                  <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>Click to upload invoice or drag &amp; drop</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Receipt photo is safely stored in your local browser sandbox
                  </p>
                </label>
              )}
            </div>

            {/* Submit Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
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
