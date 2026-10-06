import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortfolioSummary } from '../types';
import { formatCurrency } from '../utils/calculations';
import { ChevronRight } from 'lucide-react';

interface CategoryConfig {
  id: keyof PortfolioSummary['breakdown'];
  name: string;
  color: string;
  route?: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'realEstate', name: 'Real Estate', color: '#0F1E36', route: '/real-estate' },
  { id: 'fds', name: 'Fixed Deposits', color: '#334155', route: '/fds' },
  { id: 'bullions', name: 'Bullions', color: '#B58924', route: '/bullions' },
  { id: 'postOffice', name: 'Post Office', color: '#A16207', route: '/post-office' },
  { id: 'stocksMf', name: 'Stocks & MF', color: '#64748B' },
  { id: 'realizedFunds', name: 'Realized Funds', color: '#0F766E', route: '/realized-funds' }
];

interface DonutChartProps {
  portfolio: PortfolioSummary;
}

export const DonutChart: React.FC<DonutChartProps> = ({ portfolio }) => {
  const navigate = useNavigate();
  const [hoveredCategory, setHoveredCategory] = useState<CategoryConfig | null>(null);

  const breakdown = portfolio.breakdown || {
    fds: 0,
    postOffice: 0,
    stocksMf: 0,
    realEstate: 0,
    bullions: 0,
    realizedFunds: 0
  };
  const total = portfolio.total || 0;

  const radius = 86;
  const circumference = 2 * Math.PI * radius;

  // Filter items with values
  const chartItems = CATEGORIES.map((cat) => {
    const val = breakdown[cat.id] || 0;
    const pct = total > 0 ? (val / total) * 100 : 0;
    return { ...cat, value: val, percentage: pct };
  });

  // Calculate slice offsets
  let accumulatedOffset = 0;
  const slices = chartItems.map((item) => {
    const sliceLength = (item.percentage / 100) * circumference;
    const strokeGap = Math.max(0, circumference - sliceLength);
    const offset = accumulatedOffset;
    accumulatedOffset += sliceLength;
    return {
      ...item,
      sliceLength,
      strokeGap,
      offset
    };
  });

  const activeCategory = hoveredCategory;
  const activeValue = activeCategory ? (breakdown[activeCategory.id] || 0) : total;
  const activePct = activeCategory
    ? (total > 0 ? ((activeValue / total) * 100).toFixed(1) : '0')
    : '100';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 280px) 1fr',
        gap: '32px',
        alignItems: 'center'
      }}
      className="dashboard-donut-wrap"
    >
      {/* SVG Donut Visual */}
      <div style={{ position: 'relative', width: '240px', height: '240px', margin: '0 auto' }}>
        <svg
          viewBox="0 0 240 240"
          style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}
        >
          {/* Base track circle */}
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth="20"
          />

          {slices.map((slice) => {
            if (slice.value <= 0) return null;
            const isHovered = hoveredCategory?.id === slice.id;
            return (
              <circle
                key={slice.id}
                cx="120"
                cy="120"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? 26 : 20}
                strokeDasharray={`${slice.sliceLength} ${slice.strokeGap}`}
                strokeDashoffset={-slice.offset}
                strokeLinecap="butt"
                onMouseEnter={() => setHoveredCategory(slice)}
                onMouseLeave={() => setHoveredCategory(null)}
                onClick={() => {
                  if (slice.route) navigate(slice.route);
                }}
                style={{
                  cursor: slice.route ? 'pointer' : 'default',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: hoveredCategory && !isHovered ? 0.45 : 1
                }}
              />
            );
          })}
        </svg>

        {/* Center Information */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
            padding: '16px'
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: activeCategory ? activeCategory.color : 'var(--color-charcoal-muted)',
              marginBottom: '3px',
              transition: 'color 0.2s ease'
            }}
          >
            {activeCategory ? activeCategory.name : 'Total Allocation'}
          </span>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--color-navy)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            ₹ {formatCurrency(activeValue)}
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--color-charcoal-muted)',
              marginTop: '2px'
            }}
          >
            {activePct}%
          </span>
        </div>
      </div>

      {/* Clean Category Breakdown Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {CATEGORIES.map((cat) => {
          const val = breakdown[cat.id] || 0;
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
          const isHovered = hoveredCategory?.id === cat.id;

          return (
            <div
              key={cat.id}
              onMouseEnter={() => setHoveredCategory(cat)}
              onMouseLeave={() => setHoveredCategory(null)}
              onClick={() => {
                if (cat.route) navigate(cat.route);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                background: isHovered ? 'var(--bg-surface-soft)' : 'transparent',
                cursor: cat.route ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
                border: isHovered ? '1px solid var(--border-card)' : '1px solid transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: cat.color,
                    flexShrink: 0
                  }}
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: isHovered ? 700 : 600,
                    color: 'var(--color-charcoal-dark)'
                  }}
                >
                  {cat.name}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--color-charcoal-muted)',
                    minWidth: '38px',
                    textAlign: 'right'
                  }}
                >
                  {pct}%
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--color-navy)',
                    minWidth: '95px',
                    textAlign: 'right'
                  }}
                >
                  ₹ {formatCurrency(val)}
                </span>
                {cat.route ? (
                  <ChevronRight
                    size={14}
                    style={{
                      color: isHovered ? 'var(--color-navy)' : 'var(--border-medium)',
                      transition: 'color 0.15s ease'
                    }}
                  />
                ) : (
                  <span style={{ width: '14px' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

