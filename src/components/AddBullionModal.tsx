import React, { useState, useEffect } from 'react';
import { useInvestments } from '../context/InvestmentContext';
import type { BullionInvestment } from '../types';
import { convertToGrams } from '../utils/bullionCalculations';
import { uploadDocumentFile } from '../utils/fileUpload';
import {
  X,
  Upload,
  Coins,
  Trash2,
  FileText
} from 'lucide-react';

interface AddBullionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bullionToEdit?: BullionInvestment | null;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  onSaved?: (saved: BullionInvestment) => void;
}

const TYPE_SUGGESTIONS = [
  { label: 'Gold 24K', category: 'Gold' },
  { label: 'Gold 22K', category: 'Gold' },
  { label: 'Silver Bar', category: 'Silver' },
  { label: 'Silver Coin', category: 'Silver' },
  { label: 'Diamond Solitaire', category: 'Diamonds' },
  { label: 'Precious Gemstone', category: 'Stones' },
  { label: 'Platinum 950', category: 'Other' }
];

export const AddBullionModal: React.FC<AddBullionModalProps> = ({
  isOpen,
  onClose,
  bullionToEdit,
  onShowToast,
  onSaved
}) => {
  const { addOrUpdateBullion } = useInvestments();

  const [type, setType] = useState('Gold 24K');
  const [itemName, setItemName] = useState('');
  const [weight, setWeight] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<string>('g');
  const [purchaseValue, setPurchaseValue] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'sold'>('active');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Sync state when editing or opening
  useEffect(() => {
    if (bullionToEdit) {
      setType(bullionToEdit.typeName || bullionToEdit.type || 'Gold 24K');
      setItemName(bullionToEdit.itemName || '');
      setWeight(
        bullionToEdit.weight !== undefined && bullionToEdit.weight !== null
          ? String(bullionToEdit.weight)
          : (bullionToEdit.weightGrams ? String(bullionToEdit.weightGrams) : '')
      );
      setWeightUnit(bullionToEdit.weightUnit || 'g');
      setPurchaseValue(
        bullionToEdit.investedValue !== undefined && bullionToEdit.investedValue > 0
          ? String(bullionToEdit.investedValue)
          : ''
      );
      setPurchaseDate(bullionToEdit.purchaseDate || '');
      setStatus(bullionToEdit.status === 'sold' ? 'sold' : 'active');
      setPhotoUrl(bullionToEdit.photoUrl || '');
      setNotes(bullionToEdit.notes || '');
    } else {
      setType('Gold 24K');
      setItemName('');
      setWeight('');
      setWeightUnit('g');
      setPurchaseValue('');
      setPurchaseDate('');
      setStatus('active');
      setPhotoUrl('');
      setNotes('');
    }
  }, [bullionToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onShowToast('File size must be under 5MB', 'warn');
      return;
    }

    try {
      setIsUploading(true);
      const url = await uploadDocumentFile(file);
      if (url) {
        setPhotoUrl(url);
        onShowToast('Receipt / certificate attached', 'success');
      }
    } catch {
      onShowToast('Failed to upload file', 'warn');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedType = type.trim();
    if (!trimmedType) {
      onShowToast('Please provide an asset type.', 'warn');
      return;
    }

    const defaultName = itemName.trim() || trimmedType;
    const numValue = purchaseValue.trim() !== '' ? Number(purchaseValue) : undefined;
    const numWeight = weight.trim() !== '' ? Number(weight) : undefined;
    const computedWeightDisplay = numWeight !== undefined ? `${numWeight} ${weightUnit}` : undefined;
    const computedGrams = numWeight !== undefined ? convertToGrams(numWeight, weightUnit) : undefined;

    const saved = addOrUpdateBullion({
      id: bullionToEdit?.id,
      type: trimmedType,
      typeName: trimmedType,
      itemName: defaultName,
      weight: numWeight,
      weightUnit,
      weightDisplay: computedWeightDisplay,
      weightGrams: computedGrams,
      investedValue: numValue,
      purchaseDate: purchaseDate || undefined,
      status,
      photoUrl,
      notes: notes.trim() || undefined
    });

    onShowToast(
      bullionToEdit ? 'Bullion asset updated' : `Added ${defaultName} to vault`,
      'success'
    );

    if (onSaved) onSaved(saved);
    onClose();
  };

  return (
    <div className="modal-overlay bullion-modal-overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content-box bullion-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bullion-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="bullion-modal-icon-badge">
              <Coins size={18} />
            </div>
            <div>
              <h2 className="bullion-modal-title">
                {bullionToEdit ? 'Edit Bullion Asset' : 'Add Bullion Asset'}
              </h2>
              <span className="bullion-modal-sub">
                Compact physical asset record
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
        <form onSubmit={handleSubmit} className="bullion-modal-form">
          {/* 1. Asset Type */}
          <div className="form-group">
            <label className="form-label" htmlFor="bullionAssetType">
              Asset Type <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <input
              id="bullionAssetType"
              type="text"
              className="form-input"
              placeholder="e.g. Gold 24K, Silver Bar, Diamond Solitaire"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            />
            {/* Quick Suggestions Chips */}
            <div className="bullion-chips-row">
              {TYPE_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={`bullion-chip-btn ${type === s.label ? 'active' : ''}`}
                  onClick={() => setType(s.label)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Item Name / Description (Optional) */}
          <div className="form-group">
            <label className="form-label" htmlFor="bullionItemName">
              Item Name / Description <span className="text-optional">(Optional)</span>
            </label>
            <input
              id="bullionItemName"
              type="text"
              className="form-input"
              placeholder={`Defaults to "${type || 'Bullion Holding'}"`}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>

          {/* 3. Weight Measurement: value + unit dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="bullionWeight">
              Weight Measurement <span className="text-optional">(Optional)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '8px' }}>
              <input
                id="bullionWeight"
                type="number"
                min="0"
                step="any"
                className="form-input"
                placeholder="e.g. 10"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <select
                id="bullionWeightUnit"
                className="form-select"
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
              >
                <option value="g">Grams (g)</option>
                <option value="mg">Milligrams (mg)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="pound">Pound (lbs)</option>
                <option value="tola">Tola (tola)</option>
                <option value="oz">Troy Ounce (oz)</option>
              </select>
            </div>
          </div>

          {/* 4. Row: Purchase Value (Optional) & Purchase Date (Optional) */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="bullionPurchaseValue">
                Purchase Value (₹) <span className="text-optional">(Optional)</span>
              </label>
              <div className="input-affix-wrapper">
                <span className="input-prefix" style={{ color: 'var(--color-gold)' }}>₹</span>
                <input
                  id="bullionPurchaseValue"
                  type="number"
                  min="0"
                  step="any"
                  className="form-input input-with-prefix"
                  placeholder="e.g. 150000"
                  value={purchaseValue}
                  onChange={(e) => setPurchaseValue(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bullionPurchaseDate">
                Purchase Date <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="bullionPurchaseDate"
                type="date"
                className="form-input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          {/* 5. Status: Held or Sold */}
          <div className="form-group">
            <label className="form-label">
              Status <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <div className="bullion-status-toggle-row">
              <label className={`bullion-status-choice ${status === 'active' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="bullionStatus"
                  value="active"
                  checked={status === 'active'}
                  onChange={() => setStatus('active')}
                />
                <span className="bullion-status-choice-dot held" />
                <span>Held (In Vault)</span>
              </label>

              <label className={`bullion-status-choice ${status === 'sold' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="bullionStatus"
                  value="sold"
                  checked={status === 'sold'}
                  onChange={() => setStatus('sold')}
                />
                <span className="bullion-status-choice-dot sold" />
                <span>Sold (Liquidated)</span>
              </label>
            </div>
          </div>

          {/* 6. Optional Document Upload */}
          <div className="form-group">
            <label className="form-label">
              Receipt / Certificate <span className="text-optional">(Optional)</span>
            </label>
            {photoUrl ? (
              <div className="bullion-modal-doc-preview">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="var(--color-navy)" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)' }}>
                    Receipt / Document attached
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-subtle btn-sm"
                  onClick={() => setPhotoUrl('')}
                  style={{ color: '#DC2626' }}
                  title="Remove document"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <label className="bullion-upload-dropzone">
                <Upload size={18} color="var(--color-charcoal-muted)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-navy)', marginTop: '4px' }}>
                  {isUploading ? 'Uploading...' : 'Upload invoice, bill, or hallmark card'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', marginTop: '2px' }}>
                  Supports PNG, JPG, WEBP, PDF (max 5MB)
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>

          {/* 7. Notes (Optional) */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" htmlFor="bullionNotes">
              Notes <span className="text-optional">(Optional)</span>
            </label>
            <input
              id="bullionNotes"
              type="text"
              className="form-input"
              placeholder="e.g. Purchased from Tanishq, locker no. 14"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Modal Actions */}
          <div className="bullion-modal-actions">
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
              style={{ background: 'var(--color-navy)', minWidth: '120px' }}
            >
              {bullionToEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
