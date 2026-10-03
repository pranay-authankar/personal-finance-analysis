import React, { useState } from 'react';
import type { BullionInvestment } from '../types';
import { BULLION_METADATA, getEffectiveBullionValue, hasSufficientValue } from '../utils/bullionCalculations';
import { formatCurrency } from '../utils/calculations';

interface BullionDonutChartProps {
  investments: BullionInvestment[];
}

export const BullionDonutChart: React.FC<BullionDonutChartProps> = ({ investments }) => {
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  // Filter ONLY items with sufficient value information
  const verifiedItems = investments.filter(hasSufficientValue);
  const total = verifiedItems.reduce((sum, b) => sum + getEffectiveBullionValue(b), 0);

  // Aggregate by bullion type
  const typeAggregates: Record<string, { type: string; name: string; icon: string; color: string; amount: number; count: number }> = {};

  verifiedItems.forEach((b) => {
    const meta = BULLION_METADATA[b.type] || {
      name: b.typeName || 'Other',
      icon: '💎',
      color: '#7C3AED'
    };

    if (!typeAggregates[b.type]) {
      typeAggregates[b.type] = {
        type: b.type,
        name: meta.name.split(' (')[0],
        icon: meta.icon,
        color: meta.color,
        amount: 0,
        count: 0
      };
    }
    typeAggregates[b.type].amount += getEffectiveBullionValue(b);
    typeAggregates[b.type].count += 1;
  });

  const typeList = Object.values(typeAggregates);

  const radius = 72;
  const circumference = 2 * Math.PI * radius;

  let accumulatedOffset = 0;
  const slices = typeList.map((item) => {
    const pct = total > 0 ? (item.amount / total) * 100 : 0;
    const sliceLength = (pct / 100) * circumference;
    const strokeGap = Math.max(0, circumference - sliceLength);
    const offset = accumulatedOffset;
    accumulatedOffset += sliceLength;
    return {
      ...item,
      percentage: pct,
      sliceLength,
      strokeGap,
      offset
    };
  });

  const activeSlice = slices.find((s) => s.type === hoveredType) || slices[0];

  if (total === 0 || verifiedItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '14px', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-medium)' }}>
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No bullion investments with verified value yet.</p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>
          Enter purchase value or rate &amp; weight to include your bullion assets in the value distribution chart.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'center' }}>
      {/* SVG Donut Visual */}
      <div className="donut-visual-container" style={{ width: '220px', height: '220px' }}>
        <svg className="donut-svg" viewBox="0 0 220 220">
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="20"
          />

          {slices.map((slice) => {
            if (slice.amount <= 0) return null;
            return (
              <circle
                key={slice.type}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={hoveredType === slice.type ? 24 : 18}
                strokeDasharray={`${slice.sliceLength} ${slice.strokeGap}`}
                strokeDashoffset={-slice.offset}
                strokeLinecap="butt"
                className="donut-slice-path"
                onMouseEnter={() => setHoveredType(slice.type)}
                onMouseLeave={() => setHoveredType(null)}
                style={{
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  opacity: hoveredType && hoveredType !== slice.type ? 0.6 : 1
                }}
              />
            );
          })}
        </svg>

        <div className="donut-center-info">
          <span className="donut-center-name">{activeSlice?.name || 'Bullions'}</span>
          <div className="donut-center-value" style={{ fontSize: '18px' }}>
            ₹ {formatCurrency(activeSlice?.amount || total)}
          </div>
          <div className="donut-center-pct" style={{ color: activeSlice?.color || '#D97706' }}>
            {activeSlice ? `${activeSlice.percentage.toFixed(1)}%` : '100%'}
          </div>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {slices.map((slice) => (
          <div
            key={slice.type}
            onMouseEnter={() => setHoveredType(slice.type)}
            onMouseLeave={() => setHoveredType(null)}
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              background: hoveredType === slice.type ? '#F8FAFC' : 'var(--bg-surface)',
              borderLeft: `4px solid ${slice.color}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                <span>{slice.icon}</span>
                <span>{slice.name}</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {slice.percentage.toFixed(1)}%
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-family-display)', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
              ₹ {formatCurrency(slice.amount)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {slice.count} recorded {slice.count === 1 ? 'item' : 'items'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
