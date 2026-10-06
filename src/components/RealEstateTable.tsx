import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PropertyRecord, RentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  PROPERTY_TYPE_CONFIG,
  getDeadlineClassification
} from '../utils/deadlinesColorMap';
import { ArrowRight, MapPin, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface PropertyWithMeta {
  property: PropertyRecord;
  activeRent?: RentRecord;
  finances: {
    totalPurchasePaid: number;
    paymentLeft: number;
    totalSaleReceived: number;
    saleReceivableLeft: number;
    nextDueDate?: string;
    paymentStatus?: 'completed' | 'pending' | 'missed';
  };
}

interface RealEstateTableProps {
  items: PropertyWithMeta[];
  displayMode?: 'all' | 'rented' | 'sold';
}

export const RealEstateTable: React.FC<RealEstateTableProps> = ({
  items,
  displayMode = 'all'
}) => {
  const navigate = useNavigate();

  // ==========================================
  // 1. RENTED TABLE: ONLY Rent Information
  // ==========================================
  if (displayMode === 'rented') {
    return (
      <div className="card-panel table-container fade-in" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-light)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Property</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Monthly Rent</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Tenant</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Lease Period</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Next Rent Due</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ property, activeRent }) => {
              if (!activeRent) return null;

              return (
                <tr
                  key={property.p_id}
                  style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                  onClick={() => navigate(`/real-estate/${property.p_id}`)}
                >
                  <td style={{ padding: '14px 18px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                      {property.name}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <MapPin size={12} color="var(--color-primary)" />
                      {property.location}
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <strong style={{ fontSize: '15px', color: '#92400E' }}>
                      ₹ {formatCurrency(activeRent.rent_amount)}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#B45309', display: 'block' }}>/ month</span>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>
                      {activeRent.tenant_name}
                    </strong>
                    {activeRent.tenant_contact && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {activeRent.tenant_contact}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '14px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div>{formatDate(activeRent.rent_start_date)}</div>
                    {activeRent.rent_end_date && <div>to {formatDate(activeRent.rent_end_date)}</div>}
                  </td>

                  <td style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {formatDate(activeRent.next_rent_due)}
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                      <span>Details</span>
                      <ArrowRight size={13} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ==========================================
  // 2. SOLD PROPERTIES TABLE
  // ==========================================
  if (displayMode === 'sold') {
    return (
      <div className="card-panel table-container fade-in" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-light)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Property</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Sale Price</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Received (Realized)</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Receivable Left</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Next Due Date</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ property, finances }) => {
              const deadlineClass = finances.nextDueDate ? getDeadlineClassification(finances.nextDueDate) : null;

              return (
                <tr
                  key={property.p_id}
                  style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                  onClick={() => navigate(`/real-estate/${property.p_id}`)}
                >
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {property.name}
                      </strong>
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                        SOLD
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <MapPin size={12} color="var(--color-primary)" />
                      {property.location}
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      ₹ {formatCurrency(property.purchase_price)}
                    </strong>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <strong style={{ fontSize: '14px', color: '#16A34A' }}>
                      ₹ {formatCurrency(finances.totalSaleReceived)}
                    </strong>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <strong style={{ fontSize: '14px', color: finances.saleReceivableLeft > 0 ? '#DC2626' : '#64748B' }}>
                      ₹ {formatCurrency(finances.saleReceivableLeft)}
                    </strong>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    {deadlineClass ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: deadlineClass.bgTint,
                          border: `1px solid ${deadlineClass.borderTint}`,
                          color: deadlineClass.textDark
                        }}
                      >
                        {deadlineClass.isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                        <span>{deadlineClass.relativeText}</span>
                      </span>
                    ) : finances.saleReceivableLeft === 0 ? (
                      <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        <CheckCircle2 size={12} />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                      <span>Details</span>
                      <ArrowRight size={13} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ==========================================
  // 3. STANDARD PROPERTIES TABLE
  // ==========================================
  return (
    <div className="card-panel table-container fade-in" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-light)' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
            <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Property</th>
            <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Type</th>
            <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Purchase Price</th>
            <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Amount Paid</th>
            <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Remaining</th>
            <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Next Due</th>
            <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ property, activeRent, finances }) => {
            const typeConfig = PROPERTY_TYPE_CONFIG[property.p_type] || PROPERTY_TYPE_CONFIG['Land'];
            const deadlineClass = finances.nextDueDate ? getDeadlineClassification(finances.nextDueDate) : null;
            const isRented = Boolean(activeRent);
            const isSold = property.property_status === 'SOLD';

            return (
              <tr
                key={property.p_id}
                style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                onClick={() => navigate(`/real-estate/${property.p_id}`)}
              >
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {property.name}
                    </strong>
                    {isRented && (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                        RENTED
                      </span>
                    )}
                    {isSold && (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                        SOLD
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <MapPin size={12} color="var(--color-primary)" />
                    {property.location}
                    {property.area_sqft && (
                      <span style={{ marginLeft: '6px', fontWeight: 600, color: 'var(--text-secondary)' }}>• {property.area_sqft} Sq.ft</span>
                    )}
                  </span>
                </td>

                <td style={{ padding: '14px 18px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: typeConfig.bgColor,
                      color: typeConfig.color
                    }}
                  >
                    <span>{typeConfig.icon}</span>
                    <span>{typeConfig.label}</span>
                  </span>
                </td>

                <td style={{ padding: '14px 18px' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    ₹ {formatCurrency(property.purchase_price)}
                  </strong>
                </td>

                <td style={{ padding: '14px 18px' }}>
                  <strong style={{ fontSize: '14px', color: '#16A34A' }}>
                    ₹ {formatCurrency(finances.totalPurchasePaid)}
                  </strong>
                </td>

                <td style={{ padding: '14px 18px' }}>
                  <strong style={{ fontSize: '14px', color: finances.paymentLeft > 0 ? '#DC2626' : '#64748B' }}>
                    ₹ {formatCurrency(finances.paymentLeft)}
                  </strong>
                </td>

                <td style={{ padding: '14px 18px' }}>
                  {deadlineClass ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: deadlineClass.bgTint,
                        border: `1px solid ${deadlineClass.borderTint}`,
                        color: deadlineClass.textDark
                      }}
                    >
                      {deadlineClass.isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                      <span>{deadlineClass.relativeText}</span>
                    </span>
                  ) : finances.paymentLeft === 0 ? (
                    <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                      <CheckCircle2 size={12} />
                      <span>Completed</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#B45309', fontWeight: 600 }}>Pending</span>
                  )}
                </td>

                <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                    <span>Details</span>
                    <ArrowRight size={13} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
