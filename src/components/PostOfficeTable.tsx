import React from 'react';
import type { PostOfficeInvestment } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { SCHEME_METADATA } from '../utils/postOfficeCalculations';
import { useDateTime } from '../context/DateTimeContext';
import { Image as ImageIcon } from 'lucide-react';

interface PostOfficeTableProps {
  investments: PostOfficeInvestment[];
  onSelect: (id: string) => void;
}

export const PostOfficeTable: React.FC<PostOfficeTableProps> = ({ investments, onSelect }) => {
  const { now } = useDateTime();

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
            const mat = getMaturityClassification(inv.maturityDate, now);
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
                  <span className="table-principal-text">
                    ₹ {formatCurrency(inv.schemeType === 'RD' ? (inv.totalDepositedAmount ?? inv.amount) : inv.amount)}
                  </span>
                  {inv.schemeType === 'RD' && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ₹{formatCurrency(inv.monthlyDeposit || 0)}/mo ({inv.depositsMadeCount || 0} paid)
                    </div>
                  )}
                </td>
                <td>
                  {inv.interestRate ? (
                    <span className="fd-interest-badge">
                      {Number(inv.interestRate).toFixed(2)}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-charcoal-muted)' }}>-</span>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: 'var(--color-charcoal)' }}>
                    {inv.branch || 'Post Office'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                    <strong style={{ color: 'var(--color-navy)' }}>{formatDate(inv.maturityDate)}</strong>
                    <span className={`urgency-pill ${mat.pillClass}`}>{mat.relativeText}</span>
                  </div>
                </td>
                <td>
                  {inv.schemeType === 'MIS' ? (
                    <div>
                      <strong className="table-payout-text" style={{ color: 'var(--color-emerald)' }}>
                        ₹ {formatCurrency(inv.monthlyPayout || inv.expectedMonthlyInterest || 0)}
                      </strong>
                      <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>per month</div>
                    </div>
                  ) : inv.schemeType === 'SCSS' ? (
                    <div>
                      <strong className="table-payout-text" style={{ color: 'var(--color-gold-dark)' }}>
                        ₹ {formatCurrency(inv.quarterlyPayout || inv.expectedQuarterlyInterest || 0)}
                      </strong>
                      <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>per quarter</div>
                    </div>
                  ) : inv.maturityAmount ? (
                    <div>
                      <strong className="table-payout-text" style={{ color: 'var(--color-navy)' }}>
                        ₹ {formatCurrency(inv.maturityAmount)}
                      </strong>
                      <div style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)' }}>at maturity</div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Government return</span>
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
