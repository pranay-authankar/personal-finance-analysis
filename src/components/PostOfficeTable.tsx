import React from 'react';
import type { PostOfficeInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { SCHEME_METADATA } from '../utils/postOfficeCalculations';
import { Image as ImageIcon } from 'lucide-react';

interface PostOfficeTableProps {
  investments: PostOfficeInvestment[];
  onSelect: (id: string) => void;
}

export const PostOfficeTable: React.FC<PostOfficeTableProps> = ({ investments, onSelect }) => {
  return (
    <div className="fd-table-wrapper">
      <table className="fd-desktop-table">
        <thead>
          <tr>
            <th>Scheme & Account</th>
            <th>Invested / Balance</th>
            <th>Interest Rate</th>
            <th>Branch</th>
            <th>Maturity Date & Urgency</th>
            <th>Payout / Return</th>
            <th>Document</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {investments.map((inv) => {
            const mat = getMaturityClassification(inv.maturityDate);
            const meta = SCHEME_METADATA[inv.schemeType] || {
              icon: '📮',
              shortName: inv.schemeType
            };

            return (
              <tr key={inv.id} onClick={() => onSelect(inv.id)}>
                <td>
                  <div className="table-bank-col">
                    <div className="table-bank-icon" style={{ fontSize: '22px' }}>
                      {meta.icon}
                    </div>
                    <div>
                      <strong>{inv.schemeName}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{inv.accountNumber}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="table-principal-text">₹ {formatCurrency(inv.amount)}</span>
                </td>
                <td>
                  {inv.interestRate ? (
                    <span className="fd-interest-badge" style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
                      {Number(inv.interestRate).toFixed(2)}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {inv.branch || 'Post Office'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                    <strong>{formatDate(inv.maturityDate)}</strong>
                    <span className={`urgency-pill ${mat.pillClass}`}>{mat.relativeText}</span>
                  </div>
                </td>
                <td>
                  {inv.monthlyPayout ? (
                    <div>
                      <strong className="table-payout-text">₹ {formatCurrency(inv.monthlyPayout)}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>per month</div>
                    </div>
                  ) : inv.quarterlyPayout ? (
                    <div>
                      <strong className="table-payout-text">₹ {formatCurrency(inv.quarterlyPayout)}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>per quarter</div>
                    </div>
                  ) : inv.maturityAmount ? (
                    <div>
                      <strong className="table-payout-text">₹ {formatCurrency(inv.maturityAmount)}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>at maturity</div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Maturity Return</span>
                  )}
                </td>
                <td>
                  {inv.photoUrl ? (
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
                      onSelect(inv.id);
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
