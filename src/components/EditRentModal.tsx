import React, { useState, useEffect } from 'react';
import type { PropertyRecord, RentRecord } from '../types';
import { X, KeyRound, AlertCircle, Check } from 'lucide-react';

interface EditRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyRecord;
  activeRent: RentRecord;
  onSaveRent: (updates: Partial<RentRecord>) => Promise<void>;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const EditRentModal: React.FC<EditRentModalProps> = ({
  isOpen,
  onClose,
  property,
  activeRent,
  onSaveRent,
  onShowToast
}) => {
  const [tenantName, setTenantName] = useState('');
  const [tenantContact, setTenantContact] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeRent && isOpen) {
      setTenantName(activeRent.tenant_name || '');
      setTenantContact(activeRent.tenant_contact || '');
      setRentAmount(String(activeRent.rent_amount || ''));
      setStartDate(activeRent.rent_start_date || '');
      setEndDate(activeRent.rent_end_date || '');
      setNextDueDate(activeRent.next_rent_due || '');
      setNotes(activeRent.r_notes || '');
      setError('');
    }
  }, [activeRent, isOpen]);

  if (!isOpen) return null;

  const numAmount = Number(rentAmount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedTenant = tenantName.trim();
    if (!trimmedTenant) {
      setError('Please provide a tenant name');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid monthly rent amount in ₹');
      return;
    }

    if (!startDate) {
      setError('Please provide the lease start date');
      return;
    }

    if (!nextDueDate) {
      setError('Please specify the next expected rent due date');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveRent({
        tenant_name: trimmedTenant,
        tenant_contact: tenantContact.trim(),
        rent_amount: numAmount,
        rent_start_date: startDate,
        rent_end_date: endDate || '',
        next_rent_due: nextDueDate,
        r_notes: notes.trim()
      });

      if (onShowToast) {
        onShowToast(`Lease details for "${trimmedTenant}" updated!`, 'success');
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to update lease:', err);
      setError(err?.message || 'Failed to update lease. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay bullion-modal-overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content-box bullion-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px' }}
      >
        {/* Header */}
        <div className="bullion-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="bullion-modal-icon-badge" style={{ background: 'rgba(15, 30, 54, 0.08)', color: 'var(--color-navy)' }}>
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="bullion-modal-title">Edit Lease Details</h2>
              <span className="bullion-modal-sub">
                {property.name} • Tenancy Agreement
              </span>
            </div>
          </div>
          <button
            type="button"
            className="bullion-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bullion-modal-body">
          {error && (
            <div className="bullion-modal-error-box" style={{ marginBottom: '16px' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Tenant Name & Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="editTenantName">
                Tenant Name <span className="text-required">*</span>
              </label>
              <input
                id="editTenantName"
                type="text"
                className="form-input"
                placeholder="e.g. Ramesh Kumar"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editTenantContact">
                Contact Phone <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="editTenantContact"
                type="text"
                className="form-input"
                placeholder="e.g. +91 9876543210"
                value={tenantContact}
                onChange={(e) => setTenantContact(e.target.value)}
              />
            </div>
          </div>

          {/* Monthly Rent & Next Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="editRentAmount">
                Monthly Rent (₹) <span className="text-required">*</span>
              </label>
              <input
                id="editRentAmount"
                type="number"
                min="1"
                step="any"
                className="form-input"
                placeholder="e.g. 25000"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editNextRentDue">
                Next Rent Due Date <span className="text-required">*</span>
              </label>
              <input
                id="editNextRentDue"
                type="date"
                className="form-input"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Start Date & End Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="editRentStartDate">
                Lease Start Date <span className="text-required">*</span>
              </label>
              <input
                id="editRentStartDate"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="editRentEndDate">
                Lease End Date <span className="text-optional">(Optional)</span>
              </label>
              <input
                id="editRentEndDate"
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Terms & Notes */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="editRentNotes">
              Lease Terms / Notes <span className="text-optional">(Optional)</span>
            </label>
            <textarea
              id="editRentNotes"
              rows={2}
              className="form-input"
              placeholder="e.g. 11 months agreement, ₹50,000 security deposit held, annual 5% escalation"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Modal Actions */}
          <div className="bullion-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ background: 'var(--color-navy)', minWidth: '140px' }}
            >
              {isSubmitting ? 'Saving...' : (
                <>
                  <Check size={15} style={{ marginRight: '6px' }} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
