import React from 'react';
import type { FixedDeposit } from '../types';
import { calculateFDValues, formatCurrency, formatDate } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { Landmark, Image as ImageIcon } from 'lucide-react';

interface FdTableProps {
  fds: FixedDeposit[];
  onSelectFd: (id: string) => void;
}

export const FdTable: React.FC<FdTableProps> = ({ fds, onSelectFd }) => {
  return (
    <div className="fd-table-wrapper">
      <table className="fd-desktop-table">
        <thead>
          <tr>
            <th>Bank & Account</th>
            <th>Principal Amount</th>
            <th>Interest Rate</th>
            <th>Tenure</th>
            <th>Maturity Date & Urgency</th>
            <th>Maturity Value</th>
            <th>Certificate</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {fds.map((fd) => {
            const calc = calculateFDValues(fd.principal, fd.interestRate, fd.startDate, fd.maturityDate);
            const mat = getMaturityClassification(fd.maturityDate);

            return (
              <tr key={fd.id} onClick={() => onSelectFd(fd.id)}>
                <td>
                  <div className="table-bank-col">
                    <div className="table-bank-icon">
                      <Landmark size={20} color="var(--brand-primary)" />
                    </div>
                    <div>
                      <strong>{fd.bankName}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fd.accountNumber || '-'}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="table-principal-text">₹ {formatCurrency(fd.principal)}</span>
                </td>
                <td>
                  <span className="fd-interest-badge">{Number(fd.interestRate).toFixed(2)}%</span>
                </td>
                <td>
                  <span>{calc.tenureFormatted}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                    <strong>{formatDate(fd.maturityDate)}</strong>
                    <span className={`urgency-pill ${mat.pillClass}`}>{mat.relativeText}</span>
                  </div>
                </td>
                <td>
                  <strong className="table-payout-text">₹ {formatCurrency(calc.maturityAmount)}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    +₹ {formatCurrency(calc.interestEarned)} interest
                  </div>
                </td>
                <td>
                  {fd.photoUrl ? (
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
                      onSelectFd(fd.id);
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
