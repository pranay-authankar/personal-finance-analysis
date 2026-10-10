import React from 'react';
import type { RealizedTransaction } from '../utils/realizedFundsUiHelpers';
import { getAssetTypeMeta, getSourceBadgeMeta } from '../utils/realizedFundsUiHelpers';
import { formatCurrency, formatDate } from '../utils/calculations';
import { ChevronRight, Calendar, User } from 'lucide-react';

interface RealizedFundsTableProps {
  transactions: RealizedTransaction[];
  selectedId: string | null;
  onSelect: (tx: RealizedTransaction) => void;
}

export const RealizedFundsTable: React.FC<RealizedFundsTableProps> = ({
  transactions,
  selectedId,
  onSelect
}) => {
  return (
    <div className="fd-table-wrapper" style={{ borderRadius: '12px', border: '1px solid var(--border-card)' }}>
      <table className="fd-desktop-table">
        <thead>
          <tr>
            <th>Asset Name</th>
            <th>Source</th>
            <th>Family Member</th>
            <th>Payment Date</th>
            <th style={{ textAlign: 'right' }}>Amount Received</th>
            <th>Status</th>
            <th style={{ textAlign: 'center', width: '50px' }}></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const assetMeta = getAssetTypeMeta(tx.assetType);
            const sourceMeta = getSourceBadgeMeta(tx.source);
            const isSelected = selectedId === tx.id;

            return (
              <tr
                key={tx.id}
                onClick={() => onSelect(tx)}
                className={isSelected ? 'selected' : ''}
                style={{ cursor: 'pointer' }}
              >
                {/* 1. Asset Name with Icon & Category */}
                <td>
                  <div className="table-bank-col">
                    <span
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: assetMeta.bgTint,
                        border: `1px solid ${assetMeta.borderTint}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '17px',
                        flexShrink: 0
                      }}
                      title={assetMeta.label}
                    >
                      {assetMeta.icon}
                    </span>
                    <div>
                      <strong style={{ color: 'var(--color-navy)', fontSize: '14px' }}>
                        {tx.assetName}
                      </strong>
                      <div style={{ fontSize: '12px', color: 'var(--color-charcoal-muted)' }}>
                        {assetMeta.label}
                      </div>
                    </div>
                  </div>
                </td>

                {/* 2. Source Badge (Sale / Maturity) */}
                <td>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '999px',
                      background: sourceMeta.bg,
                      color: sourceMeta.color,
                      border: `1px solid ${sourceMeta.border}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>{sourceMeta.icon}</span>
                    <span>{sourceMeta.label}</span>
                  </span>
                </td>

                {/* 3. Family Member */}
                <td>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-charcoal)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <User size={12} style={{ color: 'var(--color-charcoal-muted)' }} />
                    <span>{tx.memberName}</span>
                  </span>
                </td>

                {/* 4. Payment Date */}
                <td>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-charcoal)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Calendar size={12} style={{ color: 'var(--color-charcoal-muted)' }} />
                    <span>{tx.paymentDate ? formatDate(tx.paymentDate) : '—'}</span>
                  </span>
                </td>

                {/* 5. Amount Received (Muted gold highlight) */}
                <td style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    <span style={{ color: 'var(--color-gold)', marginRight: '3px', fontWeight: 700 }}>
                      + ₹
                    </span>
                    <span>{formatCurrency(tx.amount)}</span>
                  </div>
                </td>

                {/* 6. Status */}
                <td>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(22, 163, 74, 0.08)',
                      border: '1px solid rgba(22, 163, 74, 0.25)',
                      color: '#15803D',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#16A34A',
                        display: 'inline-block'
                      }}
                    />
                    <span>Received</span>
                  </span>
                </td>

                {/* 7. Action Chevron */}
                <td style={{ textAlign: 'center' }}>
                  <ChevronRight size={16} style={{ color: 'var(--color-charcoal-light)' }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
