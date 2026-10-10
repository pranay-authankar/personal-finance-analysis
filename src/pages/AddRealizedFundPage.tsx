import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { RealizedReason, RealizedSourceCategory } from '../types';
import { calculateFDValues, formatCurrency } from '../utils/calculations';
import { getEffectiveBullionValue } from '../utils/bullionCalculations';
import { getLocalDateString } from '../utils/dateUtils';
import { ChevronLeft, Save, Wallet, Layers } from 'lucide-react';

interface AddRealizedFundPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const AddRealizedFundPage: React.FC<AddRealizedFundPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const {
    activeMember,
    addOrUpdateRealizedFund,
    getRealizedFundById,
    realizeInvestment
  } = useInvestments();

  // Active assets available to convert
  const activeFds = (activeMember.fds || []).filter((f) => !f.status || f.status === 'active');
  const activePos = (activeMember.postOfficeInvestments || []).filter((p) => !p.status || p.status === 'active');
  const activeBuls = (activeMember.bullionsInvestments || []).filter((b) => !b.status || b.status === 'active');

  const [selectedActiveAssetKey, setSelectedActiveAssetKey] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [sourceCategory, setSourceCategory] = useState<RealizedSourceCategory>('FD');
  const [sourceName, setSourceName] = useState<string>('');
  const [reason, setReason] = useState<RealizedReason>('Matured');
  const [dateReceived, setDateReceived] = useState<string>(
    getLocalDateString()
  );
  const [remarks, setRemarks] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // If editing an existing realized fund
  useEffect(() => {
    if (editId) {
      const existing = getRealizedFundById(editId);
      if (existing) {
        setAmount(existing.amount ? String(existing.amount) : '');
        setSourceCategory(existing.sourceCategory);
        setSourceName(existing.sourceName);
        setReason(existing.reason);
        setDateReceived(existing.dateReceived);
        setRemarks(existing.remarks || '');
      }
    }
  }, [editId, getRealizedFundById]);

  // When user selects an active asset from dropdown to convert
  const handleSelectActiveAsset = (key: string) => {
    setSelectedActiveAssetKey(key);
    if (!key) return;

    const [type, id] = key.split(':');

    if (type === 'fd') {
      const fd = activeFds.find((f) => f.id === id);
      if (fd) {
        const calc = calculateFDValues(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate);
        setSourceCategory('FD');
        setSourceName(`FD — ${fd.bankName} (${fd.accountNumber || 'A/C'})`);
        setAmount(String(calc.maturityAmount));
        setReason('Matured');
        setDateReceived(getLocalDateString());
        setRemarks(`Matured from FD at ${fd.bankName}. Principal ₹${formatCurrency(fd.principal)} + Interest ₹${formatCurrency(calc.interestEarned)}`);
      }
    } else if (type === 'po') {
      const po = activePos.find((p) => p.id === id);
      if (po) {
        const matAmount = po.maturityAmount || po.amount;
        setSourceCategory('Post Office');
        setSourceName(`Post Office — ${po.schemeName}`);
        setAmount(String(matAmount));
        setReason('Matured');
        setDateReceived(getLocalDateString());
        setRemarks(`Tenure completed for ${po.schemeName} (${po.accountNumber})`);
      }
    } else if (type === 'bul') {
      const bul = activeBuls.find((b) => b.id === id);
      if (bul) {
        const val = getEffectiveBullionValue(bul);
        setSourceCategory('Bullions');
        setSourceName(`${bul.typeName} — ${bul.itemName}`);
        setAmount(val > 0 ? String(val) : '');
        setReason('Sold');
        setDateReceived(getLocalDateString());
        setRemarks(`Sold ${bul.typeName} ${bul.weightDisplay ? `(${bul.weightDisplay})` : ''}`);
      }
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const numAmount = Number(amount);

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Please enter a valid amount received in ₹';
    }
    if (!sourceName.trim()) {
      errs.sourceName = 'Please enter the source asset name (e.g., FD — SBI or Gold)';
    }
    if (!dateReceived) {
      errs.dateReceived = 'Please select the date received';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (selectedActiveAssetKey && !editId) {
      // Direct realization from active investment
      const [type, id] = selectedActiveAssetKey.split(':');
      let cat: RealizedSourceCategory = 'Other';
      if (type === 'fd') cat = 'FD';
      else if (type === 'po') cat = 'Post Office';
      else if (type === 'bul') cat = 'Bullions';

      realizeInvestment({
        sourceCategory: cat,
        sourceId: id,
        amount: Number(amount),
        dateReceived,
        reason,
        remarks
      });

      onShowToast(`Moved ₹${formatCurrency(Number(amount))} to Realized Funds! Asset marked as ${reason}.`, 'success');
    } else {
      // Normal Add / Edit
      addOrUpdateRealizedFund({
        id: editId || undefined,
        amount: Number(amount),
        sourceCategory,
        sourceName: sourceName.trim(),
        reason,
        dateReceived,
        remarks: remarks.trim()
      });

      onShowToast(editId ? 'Realized fund entry updated.' : 'Realized fund entry recorded.', 'success');
    }

    navigate('/realized-funds');
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '780px', margin: '0 auto' }}>
      {/* Top Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <nav className="breadcrumb-nav">
          <span className="breadcrumb-link" onClick={() => navigate('/home')}>
            Portfolio Overview
          </span>
          <span>/</span>
          <span className="breadcrumb-link" onClick={() => navigate('/realized-funds')}>
            Realized Funds
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {editId ? 'Edit Realized Fund' : 'Add Realized Fund'}
          </span>
        </nav>
      </div>

      {/* Main Form Card */}
      <div className="card-panel" style={{ padding: '32px 36px', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#F0FDFA',
              border: '1px solid #CCFBF1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0D9488'
            }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {editId ? 'Edit Realized Fund Entry' : 'Record Realized Funds'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Track capital received from sold, matured, or redeemed assets to maintain family wealth visibility.
            </p>
          </div>
        </div>

        {/* Optional Fast Transfer from Active Asset */}
        {!editId && (activeFds.length > 0 || activePos.length > 0 || activeBuls.length > 0) && (
          <div
            style={{
              background: '#F0FDFA',
              border: '1px solid #99F6E4',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
              marginBottom: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Layers size={16} color="#0D9488" />
              <strong style={{ fontSize: '14px', color: '#0F766E' }}>
                Quick Convert from Active Investment
              </strong>
            </div>
            <p style={{ fontSize: '13px', color: '#115E59', margin: '0 0 10px 0' }}>
              Select an existing active asset to transfer its proceeds to Realized Funds. Its active value will become ₹0 and be added here without double-counting.
            </p>

            <select
              className="input-field"
              value={selectedActiveAssetKey}
              onChange={(e) => handleSelectActiveAsset(e.target.value)}
              style={{ background: 'white', borderColor: '#99F6E4', fontWeight: 600 }}
            >
              <option value="">-- Choose active asset to realize (or fill form below) --</option>
              {activeFds.length > 0 && (
                <optgroup label="🏦 Active Bank Fixed Deposits">
                  {activeFds.map((f) => (
                    <option key={`fd:${f.id}`} value={`fd:${f.id}`}>
                      {f.bankName} (Principal ₹{formatCurrency(f.principal)}, Matures {f.maturityDate})
                    </option>
                  ))}
                </optgroup>
              )}
              {activePos.length > 0 && (
                <optgroup label="📮 Active Post Office Schemes">
                  {activePos.map((p) => (
                    <option key={`po:${p.id}`} value={`po:${p.id}`}>
                      {p.schemeName} (₹{formatCurrency(p.amount)})
                    </option>
                  ))}
                </optgroup>
              )}
              {activeBuls.length > 0 && (
                <optgroup label="🪙 Active Bullions / Physical Gold">
                  {activeBuls.map((b) => (
                    <option key={`bul:${b.id}`} value={`bul:${b.id}`}>
                      {b.typeName} — {b.itemName} {b.investedValue ? `(₹${formatCurrency(b.investedValue)})` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Amount Received (Mandatory) */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                Amount Received (₹) <span style={{ color: 'var(--color-crimson)' }}>*</span>
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Maturity or Sale proceeds</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--text-muted)'
                }}
              >
                ₹
              </span>
              <input
                type="number"
                className={`input-field ${errors.amount ? 'input-error' : ''}`}
                placeholder="e.g. 500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-family-mono)' }}
                min="0"
                step="any"
              />
            </div>
            {errors.amount && <span className="field-error-msg">{errors.amount}</span>}
          </div>

          {/* Reason & Source Category in 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                Reason / Status <span style={{ color: 'var(--color-crimson)' }}>*</span>
              </label>
              <select
                className="input-field"
                value={reason}
                onChange={(e) => setReason(e.target.value as RealizedReason)}
                style={{ fontWeight: 600 }}
              >
                <option value="Matured">Matured (e.g. FD / Bond / Time Deposit)</option>
                <option value="Sold">Sold (e.g. Gold / Silver / Property)</option>
                <option value="Redeemed">Redeemed (e.g. Mutual Fund / Stocks)</option>
                <option value="Other">Other Payout</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Source Asset Type <span style={{ color: 'var(--color-crimson)' }}>*</span>
              </label>
              <select
                className="input-field"
                value={sourceCategory}
                onChange={(e) => setSourceCategory(e.target.value as RealizedSourceCategory)}
                style={{ fontWeight: 600 }}
              >
                <option value="FD">Fixed Deposit (FD)</option>
                <option value="Post Office">Post Office Scheme</option>
                <option value="Bullions">Bullions (Gold/Silver/Platinum)</option>
                <option value="Stocks">Stocks / Mutual Funds</option>
                <option value="Real Estate">Real Estate / Land / Property</option>
                <option value="Other">Other Investment</option>
              </select>
            </div>
          </div>

          {/* Source Name / Description (Mandatory) */}
          <div className="form-group">
            <label className="form-label">
              Source Investment Name <span style={{ color: 'var(--color-crimson)' }}>*</span>
            </label>
            <input
              type="text"
              className={`input-field ${errors.sourceName ? 'input-error' : ''}`}
              placeholder="e.g. FD — State Bank of India (SBI) or Gold — 24K 20g Bar"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
            {errors.sourceName && <span className="field-error-msg">{errors.sourceName}</span>}
          </div>

          {/* Date Received (Mandatory) */}
          <div className="form-group">
            <label className="form-label">
              Date Received <span style={{ color: 'var(--color-crimson)' }}>*</span>
            </label>
            <input
              type="date"
              className={`input-field ${errors.dateReceived ? 'input-error' : ''}`}
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
            />
            {errors.dateReceived && <span className="field-error-msg">{errors.dateReceived}</span>}
          </div>

          {/* Remarks / Notes (Optional) */}
          <div className="form-group">
            <label className="form-label">
              Remarks / Notes <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Funds credited to HDFC savings account; principal was reinvested partially, balance held liquid."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-light)',
              marginTop: '8px'
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/realized-funds')}
            >
              <ChevronLeft size={16} />
              <span>Cancel</span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#0D9488', borderColor: '#0F766E', padding: '10px 24px' }}
            >
              <Save size={16} />
              <span>{editId ? 'Save Changes' : 'Record Realized Fund'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
