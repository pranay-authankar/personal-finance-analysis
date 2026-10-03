import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { FilterType, SortType, ViewMode } from '../types';
import { calculateFDValues, formatCurrency } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { FdCard } from '../components/FdCard';
import { FdTable } from '../components/FdTable';
import {
  PlusCircle,
  Search,
  X,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  Landmark
} from 'lucide-react';

export const FdDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeMember } = useInvestments();

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('maturity-asc');
  const [search, setSearch] = useState('');
  const [showColorMapLegend, setShowColorMapLegend] = useState(false);

  // Only active FDs are displayed in the current investment section
  const rawFds = useMemo(() => {
    return (activeMember?.fds || []).filter((f) => !f.status || f.status === 'active');
  }, [activeMember?.fds]);

  // Summary Metrics calculations
  const totalPrincipal = useMemo(() => {
    return rawFds.reduce((sum, f) => sum + (Number(f.principal) || 0), 0);
  }, [rawFds]);

  const { totalMaturityPayout, totalInterestGain, avgInterestRate } = useMemo(() => {
    let maturitySum = 0;
    let interestSum = 0;
    let weightedRateSum = 0;

    rawFds.forEach((f) => {
      const calc = calculateFDValues(f.principal, f.interestRate, f.startDate, f.maturityDate);
      maturitySum += calc.maturityAmount;
      interestSum += calc.interestEarned;
      weightedRateSum += (Number(f.interestRate) || 0) * (Number(f.principal) || 0);
    });

    const avgRate = totalPrincipal > 0 ? (weightedRateSum / totalPrincipal).toFixed(2) : '0.00';

    return {
      totalMaturityPayout: maturitySum,
      totalInterestGain: interestSum,
      avgInterestRate: avgRate
    };
  }, [rawFds, totalPrincipal]);

  // Filter and Sort FDs
  const processedFds = useMemo(() => {
    let list = [...rawFds];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.bankName.toLowerCase().includes(q) ||
          f.accountNumber.toLowerCase().includes(q)
      );
    }

    // Filter pills
    if (filter === 'urgent') {
      list = list.filter((f) => getMaturityClassification(f.maturityDate).level === 1);
    } else if (filter === 'this-year') {
      list = list.filter((f) => getMaturityClassification(f.maturityDate).level <= 3);
    } else if (filter === 'over-year') {
      list = list.filter((f) => getMaturityClassification(f.maturityDate).level >= 4);
    } else if (filter === 'with-photo') {
      list = list.filter((f) => Boolean(f.photoUrl));
    }

    // Sorting
    list.sort((a, b) => {
      if (sort === 'maturity-asc') {
        return new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime();
      } else if (sort === 'maturity-desc') {
        return new Date(b.maturityDate).getTime() - new Date(a.maturityDate).getTime();
      } else if (sort === 'amount-desc') {
        return (Number(b.principal) || 0) - (Number(a.principal) || 0);
      } else if (sort === 'amount-asc') {
        return (Number(a.principal) || 0) - (Number(b.principal) || 0);
      } else if (sort === 'rate-desc') {
        return (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0);
      } else if (sort === 'bank-asc') {
        return a.bankName.localeCompare(b.bankName);
      } else if (sort === 'tenure-asc') {
        const tA = new Date(a.maturityDate).getTime() - new Date(a.startDate).getTime();
        const tB = new Date(b.maturityDate).getTime() - new Date(b.startDate).getTime();
        return tA - tB;
      }
      return 0;
    });

    return list;
  }, [rawFds, search, filter, sort]);

  return (
    <div className="main-content fade-in">
      {/* Header & Breadcrumbs */}
      <div className="fd-header-area">
        <div>
          <nav className="breadcrumb-nav">
            <span className="breadcrumb-link" onClick={() => navigate('/home')}>
              Portfolio Overview
            </span>
            <span>/</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Fixed Deposits</span>
          </nav>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            Fixed Deposits Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Viewing active deposits for <strong>{activeMember?.name}</strong> ({activeMember?.role})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowColorMapLegend(!showColorMapLegend)}
            title="Explain Maturity Colour Map"
          >
            <HelpCircle size={16} />
            <span>Maturity Colour Map</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/add-fd')}
          >
            <PlusCircle size={18} />
            <span>Add Fixed Deposit</span>
          </button>
        </div>
      </div>

      {/* Colour Map Legend Card (Toggleable) */}
      {showColorMapLegend && (
        <div className="card-panel" style={{ padding: '20px', marginBottom: '24px', background: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
              FD Maturity Urgency Colour Map:
            </strong>
            <button className="btn btn-subtle btn-sm" onClick={() => setShowColorMapLegend(false)}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--shade-urgent-bg)', borderLeft: '4px solid var(--shade-urgent)', color: 'var(--shade-urgent)', fontSize: '12px', fontWeight: 700 }}>
              ● &lt; 3 Months (Urgent / Darkest)
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--shade-near-bg)', borderLeft: '4px solid var(--shade-near)', color: 'var(--shade-near)', fontSize: '12px', fontWeight: 700 }}>
              ● 3 – 6 Months (Near Term)
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--shade-medium-bg)', borderLeft: '4px solid var(--shade-medium)', color: 'var(--shade-medium)', fontSize: '12px', fontWeight: 700 }}>
              ● 6 – 12 Months (Medium Term)
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--shade-light-bg)', borderLeft: '4px solid var(--shade-light)', color: 'var(--shade-light)', fontSize: '12px', fontWeight: 700 }}>
              ● 1 – 2 Years (Extended)
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--shade-lightest-bg)', borderLeft: '4px solid var(--shade-lightest)', color: 'var(--shade-lightest)', fontSize: '12px', fontWeight: 700 }}>
              ● &gt; 2 Years (Calm Sky Slate)
            </div>
          </div>
        </div>
      )}

      {/* FD Top Summary Stats Grid */}
      <div className="fd-summary-stats-grid">
        <div className="stat-metric-card highlight">
          <span className="stat-kicker">Total Value of all FDs</span>
          <span className="stat-number" style={{ color: 'var(--brand-primary)' }}>
            ₹ {formatCurrency(totalPrincipal)}
          </span>
          <span className="stat-subtext">{rawFds.length} Active {rawFds.length === 1 ? 'Deposit' : 'Deposits'}</span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Expected Maturity Payout</span>
          <span className="stat-number">₹ {formatCurrency(totalMaturityPayout)}</span>
          <span className="stat-subtext">Compounded quarterly</span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Total Interest Earned</span>
          <span className="stat-number" style={{ color: 'var(--color-emerald)' }}>
            +₹ {formatCurrency(totalInterestGain)}
          </span>
          <span className="stat-subtext">Guaranteed returns</span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Weighted Avg Rate</span>
          <span className="stat-number">{avgInterestRate}%</span>
          <span className="stat-subtext">per annum yield</span>
        </div>
      </div>

      {/* Controls Bar: Search, Filters, Sorting, and View Switcher */}
      <div className="fd-controls-bar">
        <div className="controls-top-row">
          {/* Search box */}
          <div className="search-box-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by bank name or account number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
                onClick={() => setSearch('')}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="controls-right-actions">
            {/* Sorting Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="fdSortSelect" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Sort:
              </label>
              <select
                id="fdSortSelect"
                className="form-select"
                style={{ width: 'auto', minWidth: '180px', padding: '8px 12px' }}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortType)}
              >
                <option value="maturity-asc">Maturity: Earliest First</option>
                <option value="maturity-desc">Maturity: Latest First</option>
                <option value="amount-desc">Amount: Highest First</option>
                <option value="amount-asc">Amount: Lowest First</option>
                <option value="rate-desc">Interest Rate: Highest First</option>
                <option value="bank-asc">Bank Name: A to Z</option>
                <option value="tenure-asc">Tenure: Shortest First</option>
              </select>
            </div>

            {/* View Mode Toggle: Cards vs Table */}
            <div className="view-toggle-group">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="Cards View"
              >
                <LayoutGrid size={16} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <TableIcon size={16} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="filter-pills-row">
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter:</span>
          <button
            type="button"
            className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All FDs ({rawFds.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'urgent' ? 'active' : ''}`}
            onClick={() => setFilter('urgent')}
          >
            ● &lt; 3 Months (Urgent)
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'this-year' ? 'active' : ''}`}
            onClick={() => setFilter('this-year')}
          >
            Maturing in 2026 / 1 Year
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'over-year' ? 'active' : ''}`}
            onClick={() => setFilter('over-year')}
          >
            Long Term (&gt; 1 Year)
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'with-photo' ? 'active' : ''}`}
            onClick={() => setFilter('with-photo')}
          >
            📷 With Certificate
          </button>
        </div>
      </div>

      {/* Main List Render: Cards or Table */}
      {processedFds.length === 0 ? (
        <div className="fd-empty-state">
          <div className="empty-state-icon">
            <Landmark size={36} color="var(--brand-primary)" />
          </div>
          <h3 className="empty-state-title">No Fixed Deposits Found</h3>
          <p className="empty-state-desc">
            {search || filter !== 'all'
              ? 'No deposits match your search or filter criteria. Try clearing filters.'
              : `There are no fixed deposits recorded for ${activeMember?.name}. Click below to add the first one!`}
          </p>
          {search || filter !== 'all' ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/add-fd')}
            >
              <PlusCircle size={18} />
              <span>Add Fixed Deposit Now</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="fd-cards-grid">
          {processedFds.map((fd) => (
            <FdCard
              key={fd.id}
              fd={fd}
              onClick={() => navigate(`/fds/${fd.id}`)}
            />
          ))}
        </div>
      ) : (
        <FdTable
          fds={processedFds}
          onSelectFd={(id) => navigate(`/fds/${id}`)}
        />
      )}
    </div>
  );
};
