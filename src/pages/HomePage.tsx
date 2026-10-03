import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency } from '../utils/calculations';
import { DonutChart } from '../components/DonutChart';
import { Landmark, Mail, ArrowRight, PlusCircle, Users, ArrowUpRight } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeMember, getPortfolioSummary } = useInvestments();

  if (!activeMember) return null;

  const summary = getPortfolioSummary();
  const fdCount = activeMember.fds?.length || 0;
  const poCount = activeMember.postOfficeInvestments?.length || 0;

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
              <span style={{ fontSize: '13px', color: '#93C5FD', marginLeft: '6px' }}>Total Net Worth</span>
            </div>
          </div>
        </div>

        {/* Action cards linking to active sections */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* FD Action Card */}
          <div
            className="home-hero-right-action"
            onClick={() => navigate('/fds')}
            role="button"
            tabIndex={0}
            style={{ minWidth: '220px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="hero-fd-label">Fixed Deposits</span>
              <ArrowUpRight size={16} color="#6EE7B7" />
            </div>
            <div className="hero-fd-amount">₹ {formatCurrency(summary.fdTotal)}</div>
            <div className="hero-fd-meta">
              <span>{fdCount} Active {fdCount === 1 ? 'FD' : 'FDs'}</span>
              <span style={{ color: '#6EE7B7', fontWeight: 600 }}>Manage &rarr;</span>
            </div>
          </div>

          {/* Post Office Action Card */}
          <div
            className="home-hero-right-action"
            onClick={() => navigate('/post-office')}
            role="button"
            tabIndex={0}
            style={{ minWidth: '220px', borderColor: 'rgba(251, 146, 60, 0.4)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="hero-fd-label" style={{ color: '#FDBA74' }}>Post Office</span>
              <ArrowUpRight size={16} color="#FDBA74" />
            </div>
            <div className="hero-fd-amount">₹ {formatCurrency(summary.postOfficeTotal)}</div>
            <div className="hero-fd-meta">
              <span>{poCount} Active {poCount === 1 ? 'Scheme' : 'Schemes'}</span>
              <span style={{ color: '#FDBA74', fontWeight: 600 }}>Manage &rarr;</span>
            </div>
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

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/add-fd')}>
            <PlusCircle size={16} />
            <span>Add New FD</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#EA580C', borderColor: '#C2410C' }}
            onClick={() => navigate('/add-post-office')}
          >
            <PlusCircle size={16} />
            <span>Add Post Office Scheme</span>
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
            Hover over segments or click FDs &amp; Post Office to inspect
          </div>
        </div>

        <DonutChart portfolio={summary} />
      </div>

      {/* Active Modules Context Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', boxShadow: 'var(--shadow-xs)' }}>
              <Landmark size={20} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-main)', fontSize: '15px' }}>Bank Fixed Deposits</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                {fdCount} deposits tracking quarterly yields &amp; certificate receipts.
              </p>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/fds')}>
            <span>Open FDs</span>
            <ArrowRight size={15} />
          </button>
        </div>

        <div style={{
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C', boxShadow: 'var(--shadow-xs)' }}>
              <Mail size={20} />
            </div>
            <div>
              <strong style={{ color: 'var(--text-main)', fontSize: '15px' }}>Post Office Savings</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                {poCount} government schemes (MIS, SCSS, POTD, RD, PPF, Sukanya).
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: '#EA580C', borderColor: '#C2410C' }}
            onClick={() => navigate('/post-office')}
          >
            <span>Open Post Office</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
