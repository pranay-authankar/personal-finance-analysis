import React, { useState, useMemo } from 'react';
import type { PropertyRecord, RentRecord, PaymentRecord, DocumentRecord } from '../types';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getLocalDateString } from '../utils/dateUtils';
import {
  KeyRound,
  Calendar,
  Phone,
  Plus,
  Edit3,
  Search,
  X,
  Building,
  FileText,
  ExternalLink,
  Trash2,
  Upload,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { EditRentModal } from './EditRentModal';
import { StartRentModal } from './StartRentModal';
import { uploadDocumentFile } from '../utils/fileUpload';

interface RealEstateRentSectionProps {
  properties: PropertyRecord[];
  rents: RentRecord[];
  allRentPayments?: PaymentRecord[];
  onSelectProperty: (p_id: string) => void;
  onRecordRentPayment?: (
    p_id: string,
    payload: {
      amount: number;
      payment_date: string;
      next_rent_due?: string;
      notes?: string;
      r_id?: string;
    }
  ) => Promise<void>;
  onUpdateRent: (r_id: string, updates: Partial<RentRecord>) => Promise<void>;
  onStopRent: (r_id: string) => Promise<void>;
  onStartRent: (
    p_id: string,
    payload: {
      tenant_name: string;
      tenant_contact: string;
      rent_amount: number;
      rent_start_date: string;
      rent_end_date?: string;
      next_rent_due?: string;
      r_notes?: string;
      documents?: { d_name: string; d_link: string }[];
    }
  ) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const RealEstateRentSection: React.FC<RealEstateRentSectionProps> = ({
  properties,
  rents,
  onSelectProperty,
  onUpdateRent,
  onStopRent,
  onStartRent,
  onShowToast
}) => {
  const { getDocumentsForRent, addDocument, removeDocument } = useInvestments();
  const today = getLocalDateString();

  // Modals state
  const [selectedLeaseForEdit, setSelectedLeaseForEdit] = useState<{ property: PropertyRecord; rent: RentRecord } | null>(null);
  const [propertyToLease, setPropertyToLease] = useState<PropertyRecord | null>(null);
  const [isGeneralAddModalOpen, setIsGeneralAddModalOpen] = useState(false);

  // Quick document upload modal state for a rental card
  const [quickDocModalRent, setQuickDocModalRent] = useState<{ property: PropertyRecord; rent: RentRecord } | null>(null);
  const [quickDocPreset, setQuickDocPreset] = useState('Rent Agreement');
  const [quickDocCustomTitle, setQuickDocCustomTitle] = useState('');
  const [quickDocFileName, setQuickDocFileName] = useState('');
  const [quickDocFileUrl, setQuickDocFileUrl] = useState('');
  const [isQuickDocUploading, setIsQuickDocUploading] = useState(false);
  const [quickDocError, setQuickDocError] = useState('');

  // Search filter inside rent section
  const [search, setSearch] = useState('');

  // Active properties map
  const propertyMap = useMemo(() => {
    const map = new Map<string, PropertyRecord>();
    properties.forEach((p) => map.set(p.p_id, p));
    return map;
  }, [properties]);

  // Active rentals strictly linked to active properties
  const activeRents = useMemo(() => {
    return rents.filter((r) => {
      const prop = propertyMap.get(r.p_id);
      return prop && prop.property_status === 'ACTIVE' && (r.is_active ?? (!r.rent_end_date || r.rent_end_date >= today));
    });
  }, [rents, propertyMap, today]);

  // Vacant properties (active properties without any active rental)
  const leasedPropertyIds = useMemo(() => {
    return new Set(activeRents.map((r) => r.p_id));
  }, [activeRents]);

  const vacantProperties = useMemo(() => {
    return properties.filter((p) => p.property_status === 'ACTIVE' && !leasedPropertyIds.has(p.p_id));
  }, [properties, leasedPropertyIds]);

  // Filtered active leases by search
  const filteredActiveRents = useMemo(() => {
    if (!search.trim()) return activeRents;
    const q = search.toLowerCase().trim();
    return activeRents.filter((r) => {
      const prop = propertyMap.get(r.p_id);
      return (
        r.tenant_name.toLowerCase().includes(q) ||
        r.tenant_contact.toLowerCase().includes(q) ||
        (prop?.name && prop.name.toLowerCase().includes(q)) ||
        (prop?.location && prop.location.toLowerCase().includes(q))
      );
    });
  }, [activeRents, search, propertyMap]);

  const handleEndLease = async (rent: RentRecord, propName: string) => {
    if (
      window.confirm(
        `End tenancy with tenant "${rent.tenant_name}" for property "${propName}"?\n\nThe lease history and rent documents will remain preserved.`
      )
    ) {
      try {
        await onStopRent(rent.r_id);
        onShowToast(`Tenancy ended for "${propName}". Property is now vacant.`, 'info');
      } catch (err: any) {
        onShowToast(err?.message || 'Failed to end lease.', 'warn');
      }
    }
  };

  const handleQuickDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setQuickDocError('Document exceeds 8MB limit');
        return;
      }
      setQuickDocFileName(file.name);
      setIsQuickDocUploading(true);
      setQuickDocError('');
      try {
        const uploadedUrl = await uploadDocumentFile(file);
        setQuickDocFileUrl(uploadedUrl);
      } catch {
        setQuickDocError('Failed to upload document file');
      } finally {
        setIsQuickDocUploading(false);
      }
    }
  };

  const handleQuickDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDocModalRent) return;
    setQuickDocError('');

    const title = quickDocPreset === 'Other Document' ? quickDocCustomTitle.trim() : quickDocPreset.trim();
    if (!title) {
      setQuickDocError('Please provide a document title');
      return;
    }
    if (!quickDocFileUrl && !quickDocFileName) {
      setQuickDocError('Please select a file to upload');
      return;
    }

    try {
      const link = quickDocFileUrl || `/uploads/${Date.now()}_${quickDocFileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      addDocument(quickDocModalRent.property.p_id, {
        d_name: title,
        d_link: link,
        r_id: quickDocModalRent.rent.r_id,
        d_category: 'RENT'
      });

      onShowToast(`Document "${title}" uploaded and attached!`, 'success');
      setQuickDocModalRent(null);
      setQuickDocPreset('Rent Agreement');
      setQuickDocCustomTitle('');
      setQuickDocFileName('');
      setQuickDocFileUrl('');
    } catch (err: any) {
      setQuickDocError(err?.message || 'Failed to attach document');
    }
  };

  const handleDeleteRentDoc = (d_id: string, docName: string) => {
    if (window.confirm(`Delete document "${docName}"?`)) {
      try {
        removeDocument(d_id);
        onShowToast(`Document "${docName}" deleted.`, 'info');
      } catch (err: any) {
        onShowToast(err?.message || 'Failed to delete document', 'warn');
      }
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--color-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Rental Management</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(22, 163, 74, 0.1)',
                color: '#16A34A'
              }}
            >
              {activeRents.length} {activeRents.length === 1 ? 'Rental' : 'Rentals'}
            </span>
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)', margin: '3px 0 0' }}>
            Track tenant details, monthly rent, property association, and rental documents
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Quick Search */}
          <div className="bullion-search-wrapper" style={{ width: '260px' }}>
            <Search size={14} className="bullion-search-icon" />
            <input
              type="text"
              className="bullion-search-input"
              style={{ height: '34px', fontSize: '12px' }}
              placeholder="Search tenant or property..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="bullion-search-clear-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Add Rent Details Button */}
          {properties.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsGeneralAddModalOpen(true)}
              style={{ background: 'var(--color-navy)', fontSize: '12px', padding: '7px 14px' }}
            >
              <Plus size={14} style={{ marginRight: '4px' }} />
              <span>Add Rent Details</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Active Rentals Grid (Cards displaying only the 5 things + dates) */}
      {filteredActiveRents.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
          {filteredActiveRents.map((rent) => {
            const prop = propertyMap.get(rent.p_id);
            if (!prop) return null;

            // Fetch attached rent documents
            const rentDocs: DocumentRecord[] = getDocumentsForRent(prop.p_id, rent.r_id);

            return (
              <div
                key={rent.r_id}
                className="re-card"
                style={{
                  borderLeftColor: '#16A34A',
                  cursor: 'default',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* 3. Property Details: Linked Property Name & Location */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => onSelectProperty(prop.p_id)}
                      title="Click to view property details"
                    >
                      <Building size={16} style={{ color: 'var(--color-navy)', flexShrink: 0 }} />
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: 800,
                          color: 'var(--color-navy)',
                          textDecoration: 'underline',
                          textDecorationColor: 'transparent',
                          transition: 'text-decoration-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = 'var(--color-navy)')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = 'transparent')}
                      >
                        {prop.name}
                      </h3>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', marginTop: '2px', display: 'block' }}>
                      {prop.location || 'Location not recorded'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedLeaseForEdit({ property: prop, rent })}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      title="Edit Rent Details"
                    >
                      <Edit3 size={12} style={{ marginRight: '3px' }} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-subtle btn-sm"
                      onClick={() => handleEndLease(rent, prop.name)}
                      style={{ fontSize: '11px', color: '#DC2626', padding: '4px 6px' }}
                      title="End Tenancy"
                    >
                      End
                    </button>
                  </div>
                </div>

                {/* 1, 2, 4. Tenant Details & Monthly Rent */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-soft)',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  {/* 1 & 2: Tenant Name & Contact Number */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#EEF3F8',
                        color: 'var(--color-navy)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '14px',
                        flexShrink: 0
                      }}
                    >
                      {rent.tenant_name ? rent.tenant_name.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-navy)' }}>
                        {rent.tenant_name}
                      </div>
                      {rent.tenant_contact ? (
                        <a
                          href={`tel:${rent.tenant_contact}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: 'var(--color-navy)',
                            textDecoration: 'none',
                            marginTop: '2px',
                            fontWeight: 600
                          }}
                        >
                          <Phone size={10} />
                          <span>{rent.tenant_contact}</span>
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>
                          No contact number
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4: Monthly Rent */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-charcoal-muted)', letterSpacing: '0.05em', display: 'block' }}>
                      Monthly Rent
                    </span>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#065F46' }}>
                      ₹ {formatCurrency(Number(rent.rent_amount))}
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-charcoal-muted)', marginLeft: '2px' }}>/mo</span>
                    </div>
                  </div>
                </div>

                {/* 6 & 7. Rent Start Date & Rent End Date (Optional) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-charcoal-dark)' }}>
                    <Calendar size={13} style={{ color: 'var(--color-charcoal-muted)' }} />
                    <span style={{ color: 'var(--color-charcoal-muted)' }}>Rent Start Date:</span>
                    <strong style={{ fontWeight: 600 }}>{formatDate(rent.rent_start_date)}</strong>
                  </div>

                  {rent.rent_end_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-charcoal-dark)' }}>
                      <span style={{ color: 'var(--color-charcoal-muted)' }}>End Date:</span>
                      <strong style={{ fontWeight: 600, color: '#D97706' }}>{formatDate(rent.rent_end_date)}</strong>
                    </div>
                  )}
                </div>

                {/* 5. Rent Documents Section */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-charcoal-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={12} />
                      <span>Rent Documents ({rentDocs.length})</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setQuickDocModalRent({ property: prop, rent })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-navy)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                      title="Upload Rent Document"
                    >
                      <Plus size={12} />
                      <span>Upload</span>
                    </button>
                  </div>

                  {rentDocs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {rentDocs.map((doc) => (
                        <div
                          key={doc.d_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            background: 'var(--bg-surface-soft)',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: 'var(--color-navy)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '220px'
                            }}
                            title={doc.d_name}
                          >
                            {doc.d_name}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {doc.d_link && (
                              <a
                                href={doc.d_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  color: '#2563EB',
                                  textDecoration: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600
                                }}
                                title="View document"
                              >
                                <ExternalLink size={11} />
                                <span>View</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteRentDoc(doc.d_id, doc.d_name)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-charcoal-muted)',
                                cursor: 'pointer',
                                padding: '1px'
                              }}
                              title="Delete document"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', fontStyle: 'italic' }}>
                      No rent documents attached
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state when no active leases match search or exist */
        <div className="bullion-empty-state-card" style={{ padding: '36px 24px', textAlign: 'center' }}>
          <div className="bullion-empty-state-icon" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A' }}>
            <KeyRound size={28} />
          </div>
          <h3 className="bullion-empty-state-title">
            {search ? 'No Matching Rentals Found' : 'No Rental Information'}
          </h3>
          <p className="bullion-empty-state-sub" style={{ maxWidth: '440px', margin: '8px auto 20px' }}>
            {search
              ? `No rental details match your search query "${search}".`
              : 'None of your properties currently have rental details recorded. Add rent details to track tenants and rent documents.'}
          </p>
          {vacantProperties.length > 0 && !search && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPropertyToLease(vacantProperties[0])}
              style={{ background: 'var(--color-navy)' }}
            >
              <Plus size={15} style={{ marginRight: '6px' }} />
              Add Rent Details
            </button>
          )}
        </div>
      )}

      {/* 3. Properties Without Rental Information Section */}
      {vacantProperties.length > 0 && (
        <div style={{ marginTop: '8px', background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                Properties Without Rental Information ({vacantProperties.length})
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', margin: '2px 0 0' }}>
                Active properties ready to add tenant and rent details
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {vacantProperties.map((p) => (
              <div
                key={p.p_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-surface-soft)',
                  gap: '10px'
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '14px',
                      color: 'var(--color-navy)',
                      cursor: 'pointer'
                    }}
                    onClick={() => onSelectProperty(p.p_id)}
                    title="Click to view property details"
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', marginTop: '2px' }}>
                    {p.location || 'Location unrecorded'} • No rental info
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPropertyToLease(p)}
                  style={{ fontSize: '11px', padding: '5px 10px', color: '#16A34A', borderColor: '#16A34A', flexShrink: 0 }}
                >
                  <KeyRound size={12} style={{ marginRight: '4px' }} />
                  Add Rent Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Rent Modal */}
      {selectedLeaseForEdit && (
        <EditRentModal
          isOpen={Boolean(selectedLeaseForEdit)}
          onClose={() => setSelectedLeaseForEdit(null)}
          property={selectedLeaseForEdit.property}
          activeRent={selectedLeaseForEdit.rent}
          properties={properties.filter((p) => p.property_status === 'ACTIVE')}
          onSaveRent={async (updates) => {
            await onUpdateRent(selectedLeaseForEdit.rent.r_id, updates);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Start Rent Modal (opened for a specific vacant property) */}
      {propertyToLease && (
        <StartRentModal
          isOpen={Boolean(propertyToLease)}
          onClose={() => setPropertyToLease(null)}
          property={propertyToLease}
          properties={properties.filter((p) => p.property_status === 'ACTIVE')}
          onStartRent={async (rentPayload) => {
            const targetPid = rentPayload.p_id || propertyToLease.p_id;
            await onStartRent(targetPid, rentPayload);
            setPropertyToLease(null);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Add Rent Modal (opened via top header button) */}
      {isGeneralAddModalOpen && (
        <StartRentModal
          isOpen={isGeneralAddModalOpen}
          onClose={() => setIsGeneralAddModalOpen(false)}
          property={vacantProperties[0] || properties[0] || null}
          properties={properties.filter((p) => p.property_status === 'ACTIVE')}
          onStartRent={async (rentPayload) => {
            const targetPid = rentPayload.p_id || (vacantProperties[0]?.p_id || properties[0]?.p_id);
            if (targetPid) {
              await onStartRent(targetPid, rentPayload);
            }
            setIsGeneralAddModalOpen(false);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Quick Upload Document Modal */}
      {quickDocModalRent && (
        <div className="modal-overlay bullion-modal-overlay fade-in" onClick={() => setQuickDocModalRent(null)} role="dialog" aria-modal="true">
          <div
            className="modal-content-box bullion-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div className="bullion-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: 'var(--color-navy)' }} />
                <div>
                  <h3 className="bullion-modal-title" style={{ fontSize: '16px' }}>Upload Rent Document</h3>
                  <span className="bullion-modal-sub">
                    {quickDocModalRent.property.name} • {quickDocModalRent.rent.tenant_name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="bullion-modal-close-btn"
                onClick={() => setQuickDocModalRent(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickDocSubmit} className="bullion-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {quickDocError && (
                <div className="bullion-modal-error-box">
                  <AlertCircle size={14} />
                  <span>{quickDocError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Document Type <span className="text-required">*</span></label>
                <select
                  className="form-input"
                  value={quickDocPreset}
                  onChange={(e) => setQuickDocPreset(e.target.value)}
                >
                  <option value="Rent Agreement">Rent Agreement</option>
                  <option value="Tenant ID Proof (Aadhaar / Passport)">Tenant ID Proof</option>
                  <option value="Police Verification">Police Verification</option>
                  <option value="Deposit Receipt">Deposit Receipt</option>
                  <option value="Other Document">Other Document</option>
                </select>
              </div>

              {quickDocPreset === 'Other Document' && (
                <div className="form-group">
                  <label className="form-label">Document Title <span className="text-required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Electricity Bill Receipt"
                    value={quickDocCustomTitle}
                    onChange={(e) => setQuickDocCustomTitle(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Select File <span className="text-required">*</span></label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    border: '1px dashed var(--border-card)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'var(--bg-surface-soft)',
                    fontSize: '13px',
                    color: 'var(--color-navy)'
                  }}
                >
                  {isQuickDocUploading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Uploading file...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {quickDocFileName || 'Choose File (PDF, image, doc)'}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleQuickDocUpload}
                    disabled={isQuickDocUploading}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  />
                </label>
              </div>

              <div className="bullion-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQuickDocModalRent(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isQuickDocUploading || (!quickDocFileUrl && !quickDocFileName)}
                  style={{ background: '#16A34A', borderColor: '#16A34A' }}
                >
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
