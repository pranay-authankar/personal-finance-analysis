import React from 'react';
import type { RealizedFund } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { Landmark, Mail, Coins, Building2, TrendingUp, HelpCircle, Calendar, FileText, Trash2, Edit3 } from 'lucide-react';

interface RealizedFundCardProps {
  fund: RealizedFund;
  onEdit?: (fund: RealizedFund) => void;
  onDelete?: (id: string) => void;
}

export const RealizedFundCard: React.FC<RealizedFundCardProps> = ({ fund, onEdit, onDelete }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FD':
        return <Landmark size={18} color="#2563EB" />;
      case 'Post Office':
        return <Mail size={18} color="#EA580C" />;
      case 'Bullions':
        return <Coins size={18} color="#D97706" />;
      case 'Real Estate':
        return <Building2 size={18} color="#7C3AED" />;
      case 'Stocks':
        return <TrendingUp size={18} color="#059669" />;
      default:
        return <HelpCircle size={18} color="#0D9488" />;
    }
  };

  const getReasonBadgeStyle = (reason: string) => {
    switch (reason) {
      case 'Matured':
        return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' };
      case 'Sold':
        return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
      case 'Redeemed':
        return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' };
      default:
        return { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
    }
  };

  const reasonStyle = getReasonBadgeStyle(fund.reason);

  return (
    <div
      className="card-panel"
      style={{
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
    >
      {/* Top Row: Source Asset & Reason Tag */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {getCategoryIcon(fund.sourceCategory)}
          </div>
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {fund.sourceCategory}
            </span>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: 0,
                lineHeight: 1.3
              }}
            >
              {fund.sourceName || 'Unspecified Asset'}
            </h3>
          </div>
        </div>

        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '999px',
            background: reasonStyle.bg,
            color: reasonStyle.color,
            border: `1px solid ${reasonStyle.border}`,
            whiteSpace: 'nowrap'
          }}
        >
          {fund.reason}
        </span>
      </div>

      {/* Middle Row: Amount Received */}
      <div style={{ padding: '8px 0 4px 0', borderBottom: '1px dashed #E2E8F0' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Amount Received
        </span>
        <div
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#0D9488',
            fontFamily: 'var(--font-family-mono)',
            marginTop: '2px'
          }}
        >
          ₹ {formatCurrency(fund.amount)}
        </div>
      </div>

      {/* Bottom Info: Date Received & Remarks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span>Received: </span>
          <strong style={{ color: 'var(--text-main)' }}>{formatDate(fund.dateReceived)}</strong>
        </div>

        {fund.remarks && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '12px',
              background: '#F8FAFC',
              padding: '6px 10px',
              borderRadius: '6px'
            }}
          >
            <FileText size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{fund.remarks}</span>
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      {(onEdit || onDelete) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            paddingTop: '8px',
            marginTop: 'auto',
            borderTop: '1px solid #F1F5F9'
          }}
        >
          {onEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onEdit(fund)}
              title="Edit realized fund entry"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => onDelete(fund.id)}
              title="Delete realized fund entry"
              style={{ padding: '4px 8px', color: 'var(--color-crimson)' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
