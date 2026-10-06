import React from 'react';
import type { BullionInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getBullionMetadata, getEffectiveBullionValue, hasSufficientValue } from '../utils/bullionCalculations';
import { getDeadlineClassification } from '../utils/deadlinesColorMap';
import { AlertCircle, Image as ImageIcon, Clock } from 'lucide-react';

interface BullionTableProps {
  investments: BullionInvestment[];
  onSelect: (id: string) => void;
}

export const BullionTable: React.FC<BullionTableProps> = ({ investments, onSelect }) => {
  return (
    <div className="fd-table-wrapper">
      <table className="fd-desktop-table">
        <thead>
          <tr>
            <th>Holding &amp; Bullion Type</th>
            <th>Recorded / Invested Value</th>
            <th>Weight / Quantity</th>
            <th>Purchase Date</th>
            <th>Rate / Gram</th>
            <th>Payment Due Date</th>
            <th>Status</th>
            <th>Receipt</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {investments.map((b) => {
            const isComplete = hasSufficientValue(b);
            const value = getEffectiveBullionValue(b);
            const meta = getBullionMetadata(b.typeName || b.type);
            const deadline = b.paymentDueDate ? getDeadlineClassification(b.paymentDueDate) : null;

            return (
              <tr key={b.id} onClick={() => onSelect(b.id)}>
                <td>
                  <div className="table-bank-col">
                    <div className="table-bank-icon" style={{ fontSize: '22px' }}>
                      {meta.icon}
                    </div>
                    <div>
                      <strong>{b.itemName}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{meta.name}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {isComplete ? (
                    <span className="table-principal-text">₹ {formatCurrency(value)}</span>
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Not recorded
                    </span>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {b.weightDisplay || (b.weightGrams ? `${b.weightGrams}g` : '-')}
                  </span>
                </td>
                <td>
                  <span>{b.purchaseDate ? formatDate(b.purchaseDate) : '-'}</span>
                </td>
                <td>
                  {b.purchaseRate ? (
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      ₹{formatCurrency(b.purchaseRate)} {b.weightUnit ? `/${b.weightUnit}` : ''}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </td>
                <td>
                  {b.paymentDueDate && deadline ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: deadline.bgTint,
                        border: `1px solid ${deadline.borderTint}`,
                        color: deadline.textDark,
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                      title={deadline.relativeText}
                    >
                      <Clock size={11} />
                      <span>{formatDate(b.paymentDueDate)}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>Paid in Full</span>
                  )}
                </td>
                <td>
                  {isComplete ? (
                    <span
                      className="fd-interest-badge"
                      style={{ background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0', fontSize: '11px' }}
                    >
                      Verified
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: '#FFFBEB',
                        color: '#B45309',
                        border: '1px solid #FCD34D',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      <AlertCircle size={12} />
                      <span>Needs verification</span>
                    </span>
                  )}
                </td>
                <td>
                  {b.photoUrl ? (
                    <span className="card-photo-tag">
                      <ImageIcon size={14} /> Attached
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(b.id);
                    }}
                  >
                    Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
