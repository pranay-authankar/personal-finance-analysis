import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { PropertyType } from '../types';
import { normalizePropertyType } from '../utils/realEstateUiHelpers';
import { ChevronLeft, Building } from 'lucide-react';

interface AddPropertyPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const PROPERTY_TYPES: { id: PropertyType; label: string; icon: string }[] = [
  { id: 'LAND', label: 'Land Plot', icon: '🌱' },
  { id: 'COMMERCIAL_PROPERTY', label: 'Commercial', icon: '🏢' },
  { id: 'PRIVATE_HOUSE', label: 'Private House', icon: '🏡' }
];

export const AddPropertyPage: React.FC<AddPropertyPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { addProperty, updateProperty, getPropertyById } = useInvestments();

  // Form Fields
  const [pType, setPType] = useState<PropertyType>('LAND');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [partyName, setPartyName] = useState('');
  const [partyContact, setPartyContact] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  // Load existing property when editing
  useEffect(() => {
    if (editId) {
      const existing = getPropertyById(editId);
      if (existing) {
        setPType(normalizePropertyType(existing.p_type));
        setName(existing.name || '');
        setLocation(existing.location || '');
        setPurchasePrice(
          existing.purchase_price !== undefined && existing.purchase_price > 0
            ? String(existing.purchase_price)
            : ''
        );
        setPartyName(existing.party_name || '');
        setPartyContact(existing.party_contact || '');
        setPurchaseDate(existing.purchase_date || '');
        setNotes(existing.p_notes || '');
      }
    }
  }, [editId, getPropertyById]);

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

    if (editId) {
      updateProperty(editId, {
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
      navigate(`/real-estate/${editId}`);
    } else {
      const created = addProperty({
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
      navigate(`/real-estate/${created.p_id}`);
    }
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => navigate('/real-estate')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--color-charcoal-light)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <ChevronLeft size={16} />
          <span>Back to Real Estate</span>
        </button>
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(15, 30, 54, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-navy)'
            }}
          >
            <Building size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--color-navy)' }}>
              {editId ? 'Edit Property' : 'Add Property'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)', margin: '2px 0 0 0' }}>
              Real estate portfolio holding
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* 1. Property Type Selector */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-navy)', marginBottom: '8px' }}>
              Property Type <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {PROPERTY_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPType(t.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '12px 8px',
                    borderRadius: '10px',
                    border: pType === t.id ? '2px solid var(--color-navy)' : '1px solid var(--border-subtle)',
                    background: pType === t.id ? 'rgba(15, 30, 54, 0.04)' : '#FFFFFF',
                    color: pType === t.id ? 'var(--color-navy)' : 'var(--color-charcoal-light)',
                    cursor: 'pointer',
                    fontWeight: pType === t.id ? 700 : 500,
                    fontSize: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Property Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="pagePropName" style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
              Property Name <span style={{ color: 'var(--color-gold)' }}>*</span>
            </label>
            <input
              id="pagePropName"
              type="text"
              className="form-input"
              placeholder="e.g. Palm Meadows Villa 14 / Tech Park Suite 302"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* 3. Location & Purchase Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="pageLocation" style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                Location / City <span style={{ color: 'var(--color-gold)' }}>*</span>
              </label>
              <input
                id="pageLocation"
                type="text"
                className="form-input"
                placeholder="e.g. Whitefield, Bengaluru"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pagePurchasePrice" style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                Purchase Price (₹) <span style={{ color: 'var(--color-gold)' }}>*</span>
              </label>
              <input
                id="pagePurchasePrice"
                type="number"
                min="0"
                step="any"
                className="form-input"
                placeholder="e.g. 8500000"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 4. Seller / Party Info (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="pagePartyName">
                Seller / Party Name <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="pagePartyName"
                type="text"
                className="form-input"
                placeholder="e.g. Prestige Estates Projects Ltd."
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pagePartyContact">
                Party Contact <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="pagePartyContact"
                type="text"
                className="form-input"
                placeholder="e.g. +91 98765 43210"
                value={partyContact}
                onChange={(e) => setPartyContact(e.target.value)}
              />
            </div>
          </div>

          {/* 5. Purchase Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="pagePurchaseDate">
              Purchase Date <span className="text-optional">(Optional)</span>
            </label>
            <input
              id="pagePurchaseDate"
              type="date"
              className="form-input"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          {/* 6. Notes (Optional) */}
          <div className="form-group">
            <label className="form-label" htmlFor="pagePropNotes">
              Notes <span className="text-optional">(Optional)</span>
            </label>
            <textarea
              id="pagePropNotes"
              className="form-input"
              rows={3}
              placeholder="e.g. Registration done at Indiranagar Sub-Registrar office, Khata A pending"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/real-estate')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: 'var(--color-navy)', minWidth: '130px' }}
            >
              {editId ? 'Save Changes' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyPage;
