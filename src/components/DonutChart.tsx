import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortfolioSummary } from '../types';
import { formatCurrency } from '../utils/calculations';
import { ArrowRight } from 'lucide-react';

interface CategoryConfig {
  id: keyof PortfolioSummary['breakdown'];
  name: string;
  icon: string;
  color: string;
  isFunctional: boolean;
  route?: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'fds', name: 'Fixed Deposits (FDs)', icon: '🏦', color: '#2563EB', isFunctional: true, route: '/fds' },
  { id: 'postOffice', name: 'Post Office', icon: '📮', color: '#EA580C', isFunctional: true, route: '/post-office' },
  { id: 'bullions', name: 'Bullions (Gold/Silver)', icon: '🪙', color: '#D97706', isFunctional: true, route: '/bullions' },
  { id: 'stocksMf', name: 'Stocks & MFs', icon: '📈', color: '#059669', isFunctional: false },
  { id: 'realEstate', name: 'Real Estate', icon: '🏡', color: '#7C3AED', isFunctional: false },
  { id: 'cashInHand', name: 'Cash in Hand', icon: '💵', color: '#0D9488', isFunctional: false }
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
    cashInHand: 0
  };
  const total = portfolio.total || 0;

  const radius = 78;
  const circumference = 2 * Math.PI * radius;

  // Compute items with percentages
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

  const activeCategory = hoveredCategory || CATEGORIES[0];
  const activeValue = breakdown[activeCategory.id] || 0;
  const activePct = total > 0 ? ((activeValue / total) * 100).toFixed(1) : '0';

  return (
    <div className="chart-layout-grid">
      {/* SVG Donut Visual */}
      <div className="donut-visual-container">
        <svg className="donut-svg" viewBox="0 0 240 240">
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="22"
          />

          {slices.map((slice) => {
            if (slice.value <= 0) return null;
            return (
              <circle
                key={slice.id}
                cx="120"
                cy="120"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={hoveredCategory?.id === slice.id ? 26 : 20}
                strokeDasharray={`${slice.sliceLength} ${slice.strokeGap}`}
                strokeDashoffset={-slice.offset}
                strokeLinecap="butt"
                className="donut-slice-path"
                onMouseEnter={() => setHoveredCategory(slice)}
                onMouseLeave={() => setHoveredCategory(null)}
                onClick={() => {
                  if (slice.route) navigate(slice.route);
                }}
                style={{
                  cursor: slice.route ? 'pointer' : 'default',
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  opacity: hoveredCategory && hoveredCategory.id !== slice.id ? 0.6 : 1
                }}
              />
            );
          })}
        </svg>

        <div className="donut-center-info">
          <span className="donut-center-name">{activeCategory.name.split(' (')[0]}</span>
          <div className="donut-center-value">₹ {formatCurrency(activeValue)}</div>
          <div className="donut-center-pct">{activePct}% of Total</div>
        </div>
      </div>

      {/* Category Tiles Grid */}
      <div className="category-cards-grid">
        {CATEGORIES.map((cat) => {
          const val = breakdown[cat.id] || 0;
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';

          return (
            <div
              key={cat.id}
              className={`category-tile ${cat.isFunctional ? 'clickable' : ''}`}
              style={{ '--cat-color': cat.color } as React.CSSProperties}
              onMouseEnter={() => setHoveredCategory(cat)}
              onMouseLeave={() => setHoveredCategory(null)}
              onClick={() => {
                if (cat.route) navigate(cat.route);
              }}
            >
              <div className="category-tile-head">
                <div className="category-icon-title">
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-title">{cat.name}</span>
                </div>
                {cat.isFunctional ? (
                  <span className="category-badge-pill badge-active-v1">Active</span>
                ) : (
                  <span className="category-badge-pill badge-v2-placeholder">V2 Planned</span>
                )}
              </div>

              <div className="category-amount-row">
                <span className="category-amount-val">₹ {formatCurrency(val)}</span>
                <span className="category-pct-val">{pct}%</span>
              </div>

              {cat.isFunctional && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '4px' }}>
                  <span>Open {cat.name.split(' (')[0]} Section</span>
                  <ArrowRight size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
