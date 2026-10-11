import React, { useState, useMemo } from 'react';
import type { PropertyRecord, RentRecord, PaymentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getLocalDateString } from '../utils/dateUtils';
import {
  KeyRound,
  Wallet,
  Calendar,
  Phone,
  Clock,
  Plus,
  Edit3,
  TrendingUp,
  Receipt,
  Search,
  X
} from 'lucide-react';
import { CollectRentModal } from './CollectRentModal';
import { EditRentModal } from './EditRentModal';
import { StartRentModal } from './StartRentModal';

interface RealEstateRentSectionProps {
  properties: PropertyRecord[];
  rents: RentRecord[];
  allRentPayments: PaymentRecord[];
  onSelectProperty: (p_id: string) => void;
  onRecordRentPayment: (
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
      next_rent_due: string;
      r_notes?: string;
      documents?: { d_name: string; d_link: string }[];
    }
  ) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const RealEstateRentSection: React.FC<RealEstateRentSectionProps> = ({
  properties,
  rents,
  allRentPayments,
  onSelectProperty,
  onRecordRentPayment,
  onUpdateRent,
  onStopRent,
  onStartRent,
  onShowToast
}) => {
  const today = getLocalDateString();

  // Modals state
  const [selectedLeaseForCollection, setSelectedLeaseForCollection] = useState<{ property: PropertyRecord; rent: RentRecord } | null>(null);
  const [selectedLeaseForEdit, setSelectedLeaseForEdit] = useState<{ property: PropertyRecord; rent: RentRecord } | null>(null);
  const [propertyToLease, setPropertyToLease] = useState<PropertyRecord | null>(null);

  // Search filter inside rent section
  const [search, setSearch] = useState('');

  // 1. All active leases strictly linked to user's active properties
  const propertyMap = useMemo(() => {
    const map = new Map<string, PropertyRecord>();
    properties.forEach((p) => map.set(p.p_id, p));
    return map;
  }, [properties]);

  const activeRents = useMemo(() => {
    return rents.filter((r) => {
      const prop = propertyMap.get(r.p_id);
      return prop && prop.property_status === 'ACTIVE' && (r.is_active ?? (!r.rent_end_date || r.rent_end_date >= today));
    });
  }, [rents, propertyMap, today]);

  // Vacant properties (active properties without any active lease)
  const leasedPropertyIds = useMemo(() => {
    return new Set(activeRents.map((r) => r.p_id));
  }, [activeRents]);

  const vacantProperties = useMemo(() => {
    return properties.filter((p) => p.property_status === 'ACTIVE' && !leasedPropertyIds.has(p.p_id));
  }, [properties, leasedPropertyIds]);

  // 2. Financial Calculations
  const totalMonthlyRentalIncome = useMemo(() => {
    return activeRents.reduce((sum, r) => sum + (Number(r.rent_amount) || 0), 0);
  }, [activeRents]);

  const annualRentalIncome = totalMonthlyRentalIncome * 12;

  const totalCostOfRentedProperties = useMemo(() => {
    return activeRents.reduce((sum, r) => {
      const prop = propertyMap.get(r.p_id);
      return sum + (Number(prop?.purchase_price) || 0);
    }, 0);
  }, [activeRents, propertyMap]);

  const portfolioRentalYield = useMemo(() => {
    if (totalCostOfRentedProperties <= 0) return 0;
    return (annualRentalIncome / totalCostOfRentedProperties) * 100;
  }, [annualRentalIncome, totalCostOfRentedProperties]);

  const totalRentCollectedToDate = useMemo(() => {
    return allRentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [allRentPayments]);

  const overdueLeasesCount = useMemo(() => {
    return activeRents.filter((r) => r.next_rent_due && r.next_rent_due < today).length;
  }, [activeRents, today]);

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
        `End tenancy with tenant "${rent.tenant_name}" for property "${propName}"?\n\nThe lease history and rent collection records will remain preserved.`
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

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Four Rich Rental KPI Metric Cards */}
      <div className="bullion-overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {/* Card 1: Monthly Rental Income */}
        <div className="bullion-overview-card" style={{ borderLeft: '4px solid #16A34A' }}>
          <span className="bullion-overview-kicker" style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Wallet size={12} />
            <span>Monthly Rental Income</span>
          </span>
          <div className="bullion-overview-value" style={{ color: '#065F46' }}>
            <span style={{ fontSize: '20px', marginRight: '4px' }}>₹</span>
            {formatCurrency(totalMonthlyRentalIncome)}
            <span className="bullion-overview-unit" style={{ fontSize: '13px' }}>/mo</span>
          </div>
          <div className="bullion-overview-sub">
            Run-rate: ₹ {formatCurrency(annualRentalIncome)} / year
          </div>
        </div>

        {/* Card 2: Gross Portfolio Rental Yield */}
        <div className="bullion-overview-card" style={{ borderLeft: '4px solid var(--color-gold)' }}>
          <span className="bullion-overview-kicker" style={{ color: '#B58924', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} />
            <span>Gross Rental Yield</span>
          </span>
          <div className="bullion-overview-value">
            {portfolioRentalYield > 0 ? `${portfolioRentalYield.toFixed(1)}%` : '—'}
            <span className="bullion-overview-unit" style={{ fontSize: '12px' }}>annual yield</span>
          </div>
          <div className="bullion-overview-sub">
            On ₹ {formatCurrency(totalCostOfRentedProperties)} leased property value
          </div>
        </div>

        {/* Card 3: Total Rent Collected */}
        <div className="bullion-overview-card" style={{ borderLeft: '4px solid var(--color-navy)' }}>
          <span className="bullion-overview-kicker" style={{ color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Receipt size={12} />
            <span>Total Rent Collected</span>
          </span>
          <div className="bullion-overview-value">
            <span style={{ fontSize: '20px', marginRight: '4px' }}>₹</span>
            {formatCurrency(totalRentCollectedToDate)}
          </div>
          <div className="bullion-overview-sub">
            Across {allRentPayments.length} recorded payments
          </div>
        </div>

        {/* Card 4: Tenancy & Occupancy */}
        <div className="bullion-overview-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span className="bullion-overview-kicker" style={{ color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <KeyRound size={12} />
            <span>Portfolio Occupancy</span>
          </span>
          <div className="bullion-overview-value">
            {activeRents.length}
            <span className="bullion-overview-unit" style={{ fontSize: '13px' }}>
              / {properties.filter((p) => p.property_status === 'ACTIVE').length} Rented
            </span>
          </div>
          <div className="bullion-overview-sub" style={{ color: overdueLeasesCount > 0 ? '#DC2626' : 'var(--color-charcoal-muted)' }}>
            {overdueLeasesCount > 0 ? (
              <strong>⚠️ {overdueLeasesCount} lease payment {overdueLeasesCount === 1 ? 'is' : 'are'} overdue</strong>
            ) : (
              <span>{vacantProperties.length} vacant property {vacantProperties.length === 1 ? 'available' : 'available'}</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Section Header & Quick Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
            Active Leases &amp; Tenancies ({activeRents.length})
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-charcoal-muted)', margin: '2px 0 0' }}>
            Track rent due dates, collect payments, and manage lease agreements
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
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* If vacant properties exist, provide quick Lease Property button */}
          {vacantProperties.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPropertyToLease(vacantProperties[0])}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Plus size={13} style={{ marginRight: '4px' }} />
              <span>Start New Lease</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Active Leases Grid / Cards */}
      {filteredActiveRents.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredActiveRents.map((rent) => {
            const prop = propertyMap.get(rent.p_id);
            if (!prop) return null;

            const isDueOverdue = Boolean(rent.next_rent_due && rent.next_rent_due < today);
            const isDueToday = Boolean(rent.next_rent_due && rent.next_rent_due === today);
            const propPrice = Number(prop.purchase_price) || 0;
            const singleYield = propPrice > 0 ? ((Number(rent.rent_amount) * 12) / propPrice) * 100 : 0;

            // Total rent collected for this property
            const rentPaymentsForThisProp = allRentPayments.filter(
              (p) => (prop.a_id && p.a_id === prop.a_id) || p.p_id === prop.p_id
            );
            const propRentCollected = rentPaymentsForThisProp.reduce((s, p) => s + (Number(p.amount) || 0), 0);

            return (
              <div
                key={rent.r_id}
                className="re-card"
                style={{
                  borderLeftColor: isDueOverdue ? '#DC2626' : '#16A34A',
                  cursor: 'default',
                  padding: '20px'
                }}
              >
                {/* Header: Property Name + Type */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 800,
                        color: 'var(--color-navy)',
                        cursor: 'pointer'
                      }}
                      onClick={() => onSelectProperty(prop.p_id)}
                      title="Click to view property details"
                    >
                      {prop.name}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)' }}>
                      {prop.location || 'Location not recorded'}
                    </span>
                  </div>

                  <span
                    className="bullion-status-pill"
                    style={{
                      background: 'rgba(22, 163, 74, 0.08)',
                      borderColor: 'rgba(22, 163, 74, 0.25)',
                      color: '#15803D',
                      fontWeight: 700
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#16A34A',
                        marginRight: '3px'
                      }}
                    />
                    Active Lease
                  </span>
                </div>

                {/* Tenant Box */}
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
                        fontSize: '14px'
                      }}
                    >
                      {rent.tenant_name.charAt(0).toUpperCase()}
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
                          No contact phone
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-charcoal-muted)', letterSpacing: '0.05em' }}>
                      Monthly Rent
                    </span>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#065F46' }}>
                      ₹ {formatCurrency(Number(rent.rent_amount))}
                    </div>
                    {singleYield > 0 && (
                      <span style={{ fontSize: '10px', color: '#B58924', fontWeight: 600 }}>
                        {singleYield.toFixed(1)}% yield
                      </span>
                    )}
                  </div>
                </div>

                {/* Due Date & Lease Period */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-charcoal-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={12} />
                      <span>Lease Period:</span>
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--color-charcoal-dark)' }}>
                      {formatDate(rent.rent_start_date)} – {rent.rent_end_date ? formatDate(rent.rent_end_date) : 'Ongoing'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-charcoal-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={12} />
                      <span>Next Rent Due:</span>
                    </span>
                    {rent.next_rent_due ? (
                      <span
                        style={{
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: isDueOverdue
                            ? 'rgba(220, 38, 38, 0.1)'
                            : isDueToday
                            ? 'rgba(217, 119, 6, 0.1)'
                            : 'rgba(22, 163, 74, 0.1)',
                          color: isDueOverdue ? '#DC2626' : isDueToday ? '#D97706' : '#15803D'
                        }}
                      >
                        {formatDate(rent.next_rent_due)} {isDueOverdue ? '• Overdue' : isDueToday ? '• Due Today' : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-charcoal-muted)' }}>Not set</span>
                    )}
                  </div>

                  {propRentCollected > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '6px' }}>
                      <span style={{ color: 'var(--color-charcoal-muted)' }}>Total Collected:</span>
                      <span style={{ fontWeight: 700, color: '#065F46' }}>
                        ₹ {formatCurrency(propRentCollected)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Workflow Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedLeaseForCollection({ property: prop, rent })}
                    style={{
                      background: '#16A34A',
                      borderColor: '#16A34A',
                      flex: 1,
                      justifyContent: 'center',
                      fontSize: '12px',
                      padding: '6px 12px'
                    }}
                  >
                    <Wallet size={13} style={{ marginRight: '4px' }} />
                    <span>Collect Rent</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedLeaseForEdit({ property: prop, rent })}
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                    title="Edit Lease Details"
                  >
                    <Edit3 size={13} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-subtle btn-sm"
                    onClick={() => handleEndLease(rent, prop.name)}
                    style={{ fontSize: '11px', color: '#DC2626', padding: '6px 8px' }}
                    title="End Tenancy"
                  >
                    End Lease
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bullion-empty-state-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div className="bullion-empty-state-icon" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A' }}>
            <KeyRound size={28} />
          </div>
          <h3 className="bullion-empty-state-title">No Active Leases Found</h3>
          <p className="bullion-empty-state-sub" style={{ maxWidth: '440px', margin: '8px auto 20px' }}>
            {search
              ? `No active leases match your search query "${search}".`
              : 'You have not leased out any properties yet. Put an active property on rent to start tracking monthly cash flows.'}
          </p>
          {vacantProperties.length > 0 && !search && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPropertyToLease(vacantProperties[0])}
              style={{ background: 'var(--color-navy)' }}
            >
              <Plus size={15} style={{ marginRight: '6px' }} />
              Lease a Property
            </button>
          )}
        </div>
      )}

      {/* 4. Vacant Properties ("Available to Lease") Section */}
      {vacantProperties.length > 0 && (
        <div style={{ marginTop: '12px', background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                Vacant Properties Available for Rent ({vacantProperties.length})
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', margin: '2px 0 0' }}>
                Active properties not currently generating rental income
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
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
                  background: 'var(--bg-surface-soft)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-navy)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', marginTop: '2px' }}>
                    {p.location || 'Location unrecorded'} • ₹ {formatCurrency(Number(p.purchase_price) || 0)}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPropertyToLease(p)}
                  style={{ fontSize: '11px', padding: '4px 10px', color: '#16A34A', borderColor: '#16A34A' }}
                >
                  <KeyRound size={12} style={{ marginRight: '4px' }} />
                  Start Lease
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Rent Collections History Ledger */}
      {allRentPayments.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                Rent Payment Ledger ({allRentPayments.length})
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)', margin: '2px 0 0' }}>
                Chronological record of all rent receipts recorded in the vault
              </p>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#065F46' }}>
              Total: ₹ {formatCurrency(totalRentCollectedToDate)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allRentPayments.map((payment) => {
              const prop = properties.find((p) => p.a_id === payment.a_id || p.p_id === payment.p_id);
              return (
                <div
                  key={payment.payment_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface-soft)',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: 'rgba(22, 163, 74, 0.1)',
                        color: '#16A34A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Receipt size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                        {prop?.name || 'Rented Property'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', marginTop: '1px' }}>
                        {payment.payment_date ? formatDate(payment.payment_date) : 'Date unrecorded'}
                        {payment.notes ? ` • ${payment.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#065F46' }}>
                      + ₹ {formatCurrency(payment.amount)}
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(22, 163, 74, 0.1)',
                        color: '#15803D',
                        display: 'inline-block',
                        marginTop: '2px'
                      }}
                    >
                      RECEIVED
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collect Rent Modal */}
      {selectedLeaseForCollection && (
        <CollectRentModal
          isOpen={Boolean(selectedLeaseForCollection)}
          onClose={() => setSelectedLeaseForCollection(null)}
          property={selectedLeaseForCollection.property}
          activeRent={selectedLeaseForCollection.rent}
          onRecordPayment={async (payload) => {
            await onRecordRentPayment(selectedLeaseForCollection.property.p_id, {
              ...payload,
              r_id: selectedLeaseForCollection.rent.r_id
            });
            setSelectedLeaseForCollection(null);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Edit Rent Modal */}
      {selectedLeaseForEdit && (
        <EditRentModal
          isOpen={Boolean(selectedLeaseForEdit)}
          onClose={() => setSelectedLeaseForEdit(null)}
          property={selectedLeaseForEdit.property}
          activeRent={selectedLeaseForEdit.rent}
          onSaveRent={async (updates) => {
            await onUpdateRent(selectedLeaseForEdit.rent.r_id, updates);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Start Rent Modal (for vacant property) */}
      {propertyToLease && (
        <StartRentModal
          isOpen={Boolean(propertyToLease)}
          onClose={() => setPropertyToLease(null)}
          property={propertyToLease}
          onStartRent={async (rentPayload) => {
            await onStartRent(propertyToLease.p_id, rentPayload);
            setPropertyToLease(null);
          }}
        />
      )}
    </div>
  );
};
