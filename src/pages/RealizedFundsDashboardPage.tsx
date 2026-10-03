import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { RealizedFund, RealizedReason } from '../types';
import { formatCurrency } from '../utils/calculations';
import { RealizedFundCard } from '../components/RealizedFundCard';
import { Wallet, PlusCircle, Search, X } from 'lucide-react';

interface RealizedFundsDashboardPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const RealizedFundsDashboardPage: React.FC<RealizedFundsDashboardPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { activeMember, deleteRealizedFund, getPortfolioSummary } = useInvestments();

  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sort, setSort] = useState<string>('date-desc');
  const [search, setSearch] = useState('');

  const summary = getPortfolioSummary();
  const realizedFunds = activeMember.realizedFunds || [];

  // Totals by reason
  const statsByReason = useMemo(() => {
    const stats: Record<RealizedReason, { total: number; count: number }> = {
      Matured: { total: 0, count: 0 },
      Sold: { total: 0, count: 0 },
      Redeemed: { total: 0, count: 0 },
      Other: { total: 0, count: 0 }
    };

    realizedFunds.forEach((rf) => {
      const r = rf.reason || 'Other';
      if (!stats[r]) stats[r] = { total: 0, count: 0 };
      stats[r].total += Number(rf.amount) || 0;
      stats[r].count += 1;
    });

    return stats;
  }, [realizedFunds]);

  // Filtered & Sorted list
  const filteredFunds = useMemo(() => {
    return realizedFunds
      .filter((rf) => {
        // Reason filter
        if (reasonFilter !== 'all' && rf.reason !== reasonFilter) return false;

        // Category filter
        if (categoryFilter !== 'all' && rf.sourceCategory !== categoryFilter) return false;

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchSource = rf.sourceName?.toLowerCase().includes(q);
          const matchRemarks = rf.remarks?.toLowerCase().includes(q);
          const matchCat = rf.sourceCategory?.toLowerCase().includes(q);
          const matchReason = rf.reason?.toLowerCase().includes(q);
          if (!matchSource && !matchRemarks && !matchCat && !matchReason) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sort === 'date-desc') {
          return new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime();
        }
        if (sort === 'date-asc') {
          return new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime();
        }
        if (sort === 'amount-desc') {
          return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        }
        if (sort === 'amount-asc') {
          return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        }
        return 0;
      });
  }, [realizedFunds, reasonFilter, categoryFilter, search, sort]);

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this realized fund entry?')) {
      deleteRealizedFund(id);
      onShowToast('Realized fund entry removed.', 'info');
    }
  };

  const handleEdit = (fund: RealizedFund) => {
    navigate(`/add-realized-fund?edit=${fund.id}`);
  };

  return (
    <div className="main-content fade-in">
      {/* Top Breadcrumb */}
      <div style={{ marginBottom: '16px' }}>
        <nav className="breadcrumb-nav">
          <span className="breadcrumb-link" onClick={() => navigate('/home')}>
            Portfolio Overview
          </span>
          <span>/</span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Realized Funds</span>
        </nav>
      </div>

      {/* Hero Overview Panel */}
      <div
        className="card-panel"
        style={{
          background: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
          color: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 36px',
          marginBottom: '28px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.04em'
                  }}
                >
                  💼 AVAILABLE LIQUID CAPITAL
                </span>
                <span style={{ fontSize: '13px', color: '#99F6E4' }}>
                  {activeMember.name} • {realizedFunds.length} Entries
                </span>
              </div>
              <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0 4px 0', letterSpacing: '-0.02em', color: 'white' }}>
                Total Realized Funds
              </h1>
              <p style={{ color: '#CCFBF1', fontSize: '14px', maxWidth: '640px', margin: 0 }}>
                Money received when an investment is <strong>sold, matured, or redeemed</strong>. These funds remain part of the family’s overall tracked wealth without vanishing upon asset completion.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#99F6E4', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Realized Value
              </div>
              <div style={{ fontSize: '38px', fontWeight: 900, fontFamily: 'var(--font-family-mono)', color: 'white', marginTop: '2px' }}>
                ₹ {formatCurrency(summary.realizedFundsTotal)}
              </div>
              <div style={{ fontSize: '12px', color: '#CCFBF1', marginTop: '4px' }}>
                Combined Portfolio Wealth: ₹ {formatCurrency(summary.total)}
              </div>
            </div>
          </div>

          {/* Reason Breakdown Pills */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            {(['Matured', 'Sold', 'Redeemed', 'Other'] as RealizedReason[]).map((r) => {
              const item = statsByReason[r] || { total: 0, count: 0 };
              return (
                <div
                  key={r}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(8px)',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#CCFBF1', textTransform: 'uppercase', fontWeight: 700 }}>
                    {r} ({item.count})
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-family-mono)', color: 'white', marginTop: '2px' }}>
                    ₹ {formatCurrency(item.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Bar & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Realized Amounts History
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Showing {filteredFunds.length} of {realizedFunds.length} realized entries
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{ background: '#0D9488', borderColor: '#0F766E' }}
          onClick={() => navigate('/add-realized-fund')}
        >
          <PlusCircle size={16} />
          <span>+ Add Realized Fund</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card-panel"
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search by source (e.g. SBI, Gold, Plot) or remarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Reason Filter Buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>
              Reason:
            </span>
            {['all', 'Matured', 'Sold', 'Redeemed', 'Other'].map((r) => (
              <button
                key={r}
                className={`btn btn-sm ${reasonFilter === r ? 'btn-primary' : 'btn-secondary'}`}
                style={
                  reasonFilter === r
                    ? { background: '#0D9488', borderColor: '#0F766E' }
                    : { background: 'white' }
                }
                onClick={() => setReasonFilter(r)}
              >
                {r === 'all' ? 'All Reasons' : r}
              </button>
            ))}
          </div>

          {/* Source Category Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Source:
            </span>
            <select
              className="input-field"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', width: 'auto' }}
            >
              <option value="all">All Asset Types</option>
              <option value="FD">Fixed Deposits (FD)</option>
              <option value="Post Office">Post Office Schemes</option>
              <option value="Bullions">Bullions (Gold/Silver)</option>
              <option value="Stocks">Stocks / Mutual Funds</option>
              <option value="Real Estate">Real Estate / Property</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Sort:
            </span>
            <select
              className="input-field"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px', width: 'auto' }}
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="amount-desc">Amount (Highest First)</option>
              <option value="amount-asc">Amount (Lowest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredFunds.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredFunds.map((fund) => (
            <RealizedFundCard
              key={fund.id}
              fund={fund}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div
          className="card-panel"
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#F0FDFA',
              border: '1px solid #CCFBF1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0D9488'
            }}
          >
            <Wallet size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              No Realized Funds Found
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '480px', margin: 0 }}>
              {search || reasonFilter !== 'all' || categoryFilter !== 'all'
                ? 'No realized records match your active search and filter criteria. Try resetting the filters.'
                : 'When an FD matures, gold is sold, or an investment is redeemed, record the proceeds here to maintain the family’s overall tracked wealth.'}
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ background: '#0D9488', borderColor: '#0F766E', marginTop: '6px' }}
            onClick={() => navigate('/add-realized-fund')}
          >
            <PlusCircle size={16} />
            <span>+ Add First Realized Fund</span>
          </button>
        </div>
      )}
    </div>
  );
};
