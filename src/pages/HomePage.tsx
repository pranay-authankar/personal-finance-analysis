import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency } from '../utils/calculations';
import { DonutChart } from '../components/DonutChart';
import { Landmark, ArrowRight, PlusCircle, Users, ArrowUpRight } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeMember, getPortfolioSummary } = useInvestments();

  if (!activeMember) return null;

  const summary = getPortfolioSummary();
  const fdCount = activeMember.fds?.length || 0;

  return (
    <div className="main-content fade-in">
      {/* Hero Overview Card */}
      <div className="home-hero-card">
        <div className="home-hero-left">
          <div className="home-hero-avatar">{activeMember.avatar || '👨'}</div>
          <div>
            <div className="home-hero-kicker">{activeMember.role}'s Portfolio</div>
            <h1 className="home-hero-title">{activeMember.name}</h1>
            <div className="home-total-investment-display">
              <span className="home-currency-symbol">₹</span>
              <span className="home-total-number">{formatCurrency(summary.total)}</span>
              <span style={{ fontSize: '13px', color: '#94A3B8', marginLeft: '6px' }}>Total Net Worth</span>
            </div>
          </div>
        </div>

        {/* Action card linking directly to FD Section */}
        <div
          className="home-hero-right-action"
          onClick={() => navigate('/fds')}
          role="button"
          tabIndex={0}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="hero-fd-label">Fixed Deposits (FDs)</span>
            <ArrowUpRight size={18} color="#6EE7B7" />
          </div>
          <div className="hero-fd-amount">₹ {formatCurrency(summary.fdTotal)}</div>
          <div className="hero-fd-meta">
            <span>{fdCount} Active {fdCount === 1 ? 'Deposit' : 'Deposits'}</span>
            <span style={{ color: '#6EE7B7', fontWeight: 600 }}>Manage &rarr;</span>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/family-select')}>
            <Users size={16} />
            <span>Switch Member</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/add-fd')}>
            <PlusCircle size={16} />
            <span>Add New Fixed Deposit</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/fds')}>
            <Landmark size={16} />
            <span>View All FDs ({fdCount})</span>
          </button>
        </div>
      </div>

      {/* Donut Chart & Category Breakdown Section */}
      <div className="card-panel home-chart-card">
        <div className="home-section-header">
          <div>
            <span className="kicker">Asset Allocation</span>
            <h2 className="home-section-title">Portfolio Distribution Across 6 Categories</h2>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Hover over segments or click FDs to inspect
          </div>
        </div>

        <DonutChart portfolio={summary} />
      </div>

      {/* V1 Scope Context Banner */}
      <div style={{
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', boxShadow: 'var(--shadow-xs)' }}>
            <Landmark size={20} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-main)', fontSize: '15px' }}>FD Tracking Module is Active in V1</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
              Track maturity timelines, interest gains, and deposit certificates. Click below to inspect the dedicated Fixed Deposit dashboard.
            </p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/fds')}>
          <span>Open FD Section</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
