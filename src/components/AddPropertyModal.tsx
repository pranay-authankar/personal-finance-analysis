import React, { useState, useEffect } from 'react';
import { useInvestments } from '../context/InvestmentContext';
import type { PropertyRecord, PropertyType } from '../types';
import { normalizePropertyType } from '../utils/realEstateUiHelpers';
import { X, Building } from 'lucide-react';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyToEdit?: PropertyRecord | null;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  onSaved?: (saved: PropertyRecord) => void;
}

const PROPERTY_TYPES: { id: PropertyType; label: string; icon: string }[] = [
  { id: 'LAND', label: 'Land Plot', icon: '🌱' },
  { id: 'COMMERCIAL_PROPERTY', label: 'Commercial', icon: '🏢' },
  { id: 'PRIVATE_HOUSE', label: 'Private House', icon: '🏡' }
];

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  propertyToEdit,
  onShowToast,
  onSaved
}) => {
  const { addProperty, updateProperty } = useInvestments();

  const [pType, setPType] = useState<PropertyType>('LAND');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [partyName, setPartyName] = useState('');
  const [partyContact, setPartyContact] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Sync state when opening or editing
  useEffect(() => {
    if (propertyToEdit) {
      setPType(normalizePropertyType(propertyToEdit.p_type));
      setName(propertyToEdit.name || '');
      setLocation(propertyToEdit.location || '');
      setPurchasePrice(
        propertyToEdit.purchase_price !== undefined && propertyToEdit.purchase_price > 0
          ? String(propertyToEdit.purchase_price)
          : ''
      );
      setPartyName(propertyToEdit.party_name || '');
      setPartyContact(propertyToEdit.party_contact || '');
      setPurchaseDate(propertyToEdit.purchase_date || '');
      setNotes(propertyToEdit.p_notes || '');
    } else {
      setPType('LAND');
      setName('');
      setLocation('');
      setPurchasePrice('');
      setPartyName('');
      setPartyContact('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [propertyToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    const numPrice = Number(purchasePrice);

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

    if (propertyToEdit) {
      updateProperty(propertyToEdit.p_id, {
        p_type: pType,
        name: trimmedName,
        location: trimmedLocation,
        purchase_price: numPrice,
        party_name: partyName.trim(),
        party_contact: partyContact.trim(),
        purchase_date: purchaseDate || undefined,
        p_notes: notes.trim()
      });

      onShowToast(`Property "${trimmedName}" updated!`, 'success');
      if (onSaved) {
        onSaved({
          ...propertyToEdit,
          p_type: pType,
          name: trimmedName,
          location: trimmedLocation,
          purchase_price: numPrice,
          party_name: partyName.trim(),
          party_contact: partyContact.trim(),
          purchase_date: purchaseDate || '',
          p_notes: notes.trim()
        });
      }
    } else {
      const saved = addProperty({
        p_type: pType,
        name: trimmedName,
        location: trimmedLocation,
        purchase_price: numPrice,
        party_name: partyName.trim(),
        party_contact: partyContact.trim(),
        purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
        p_notes: notes.trim()
      });

      onShowToast(`Property "${trimmedName}" added to portfolio!`, 'success');
      if (onSaved) onSaved(saved);
    }

    onClose();
  };

  return (
    <div className="modal-overlay bullion-modal-overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content-box bullion-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px' }}
      >
        {/* Modal Header */}
        <div className="bullion-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="bullion-modal-icon-badge">
              <Building size={18} />
            </div>
            <div>
              <h2 className="bullion-modal-title">
                {propertyToEdit ? 'Edit Property' : 'Add Property'}
              </h2>
              <span className="bullion-modal-sub">
                Real estate investment holding
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
          {/* 1. Property Type */}
          <div className="form-group">
            <label className="form-label">
              Property Type <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <div className="bullion-chips-row">
              {PROPERTY_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  className={`bullion-chip-btn ${pType === pt.id ? 'active' : ''}`}
                  onClick={() => setPType(pt.id)}
                >
                  <span style={{ marginRight: '4px' }}>{pt.icon}</span>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Property Name & Location */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="reModalName">
                Property Name <span style={{ color: 'var(--color-gold)' }}>*</span>
              </label>
              <input
                id="reModalName"
                type="text"
                className="form-input"
                placeholder="e.g. Green Valley Plot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reModalLocation">
                Location <span style={{ color: 'var(--color-gold)' }}>*</span>
              </label>
              <input
                id="reModalLocation"
                type="text"
                className="form-input"
                placeholder="e.g. Baner, Pune"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 3. Purchase Price & Purchase Date */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="reModalPrice">
                Purchase Price (₹) <span style={{ color: 'var(--color-gold)' }}>*</span>
              </label>
              <div className="input-affix-wrapper">
                <span className="input-prefix" style={{ color: 'var(--color-gold)' }}>₹</span>
                <input
                  id="reModalPrice"
                  type="number"
                  min="0"
                  step="any"
                  className="form-input input-with-prefix"
                  placeholder="e.g. 4500000"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reModalDate">
                Purchase Date <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="reModalDate"
                type="date"
                className="form-input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          {/* 4. Seller / Party Name & Contact (Optional) */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="reModalPartyName">
                Seller / Party Name <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="reModalPartyName"
                type="text"
                className="form-input"
                placeholder="e.g. Ramesh Kulkarni"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reModalPartyContact">
                Party Contact <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="reModalPartyContact"
                type="text"
                className="form-input"
                placeholder="e.g. +91 98765 43210"
                value={partyContact}
                onChange={(e) => setPartyContact(e.target.value)}
              />
            </div>
          </div>

          {/* 5. Notes (Optional) */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" htmlFor="reModalNotes">
              Notes <span className="text-optional">(Optional)</span>
            </label>
            <textarea
              id="reModalNotes"
              rows={2}
              className="form-input"
              placeholder="e.g. Registered in sub-registrar office, road facing plot"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
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
              style={{ background: 'var(--color-navy)', minWidth: '130px' }}
            >
              {propertyToEdit ? 'Save Changes' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
