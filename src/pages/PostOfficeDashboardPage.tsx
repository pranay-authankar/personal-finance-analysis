import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { FilterType, SortType, ViewMode } from '../types';
import { formatCurrency } from '../utils/calculations';
import { getMaturityClassification } from '../utils/maturityColorMap';
import { PostOfficeCard } from '../components/PostOfficeCard';
import { PostOfficeTable } from '../components/PostOfficeTable';
import { PostOfficeDonutChart } from '../components/PostOfficeDonutChart';
import {
  PlusCircle,
  Search,
  X,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  Mail
} from 'lucide-react';

export const PostOfficeDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeMember } = useInvestments();

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filter, setFilter] = useState<FilterType>('all');
  const [schemeFilter, setSchemeFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortType>('maturity-asc');
  const [search, setSearch] = useState('');
  const [showColorMapLegend, setShowColorMapLegend] = useState(false);

  const rawInvestments = activeMember?.postOfficeInvestments || [];

  // Metrics
  const totalValue = useMemo(() => {
    return rawInvestments.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [rawInvestments]);

  const totalMonthlyIncome = useMemo(() => {
    return rawInvestments.reduce((sum, inv) => sum + (Number(inv.monthlyPayout) || 0), 0);
  }, [rawInvestments]);

  const totalQuarterlyIncome = useMemo(() => {
    return rawInvestments.reduce((sum, inv) => sum + (Number(inv.quarterlyPayout) || 0), 0);
  }, [rawInvestments]);

  // Filtering and Sorting
  const processedInvestments = useMemo(() => {
    let list = [...rawInvestments];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (inv) =>
          inv.schemeName.toLowerCase().includes(q) ||
          inv.accountNumber.toLowerCase().includes(q) ||
          (inv.branch && inv.branch.toLowerCase().includes(q))
      );
    }

    // Specific scheme filter
    if (schemeFilter !== 'all') {
      list = list.filter((inv) => inv.schemeType === schemeFilter);
    }

    // General filter pills
    if (filter === 'urgent') {
      list = list.filter((inv) => getMaturityClassification(inv.maturityDate).level === 1);
    } else if (filter === 'this-year') {
      list = list.filter((inv) => getMaturityClassification(inv.maturityDate).level <= 3);
    } else if (filter === 'over-year') {
      list = list.filter((inv) => getMaturityClassification(inv.maturityDate).level >= 4);
    } else if (filter === 'with-photo') {
      list = list.filter((inv) => Boolean(inv.photoUrl));
    }

    // Sorting
    list.sort((a, b) => {
      if (sort === 'maturity-asc') {
        return new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime();
      } else if (sort === 'maturity-desc') {
        return new Date(b.maturityDate).getTime() - new Date(a.maturityDate).getTime();
      } else if (sort === 'amount-desc') {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      } else if (sort === 'amount-asc') {
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      } else if (sort === 'rate-desc') {
        return (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0);
      } else if (sort === 'bank-asc') {
        return a.schemeName.localeCompare(b.schemeName);
      }
      return 0;
    });

    return list;
  }, [rawInvestments, search, schemeFilter, filter, sort]);

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
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Post Office Schemes</span>
          </nav>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            Post Office Savings &amp; Investment Vault
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Viewing government post office deposits for <strong>{activeMember?.name}</strong> ({activeMember?.role})
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
            style={{ background: '#EA580C', borderColor: '#C2410C' }}
            onClick={() => navigate('/add-post-office')}
          >
            <PlusCircle size={18} />
            <span>Add Post Office Investment</span>
          </button>
        </div>
      </div>

      {/* Colour Map Legend Card (Toggleable) */}
      {showColorMapLegend && (
        <div className="card-panel" style={{ padding: '20px', marginBottom: '24px', background: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
              Post Office Maturity Urgency Colour Map:
            </strong>
            <button className="btn btn-subtle btn-sm" onClick={() => setShowColorMapLegend(false)}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--shade-urgent-bg)', borderLeft: '4px solid var(--shade-urgent)', color: 'var(--shade-urgent)', fontSize: '12px', fontWeight: 700 }}>
              ● &lt; 3 Months (Immediate / Urgent)
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

      {/* Top Post Office Summary Metrics Grid */}
      <div className="fd-summary-stats-grid">
        <div className="stat-metric-card" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
          <span className="stat-kicker">Total Post Office Investment</span>
          <span className="stat-number" style={{ color: '#EA580C' }}>
            ₹ {formatCurrency(totalValue)}
          </span>
          <span className="stat-subtext">
            {rawInvestments.length} Active {rawInvestments.length === 1 ? 'Scheme' : 'Schemes'}
          </span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Monthly Guaranteed Income</span>
          <span className="stat-number" style={{ color: 'var(--color-emerald)' }}>
            ₹ {formatCurrency(totalMonthlyIncome)}
          </span>
          <span className="stat-subtext">via Monthly Income Scheme (MIS)</span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Quarterly Senior Returns</span>
          <span className="stat-number" style={{ color: '#2563EB' }}>
            ₹ {formatCurrency(totalQuarterlyIncome)}
          </span>
          <span className="stat-subtext">via SCSS Senior Citizen accounts</span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Sovereign Safety</span>
          <span className="stat-number" style={{ fontSize: '20px', color: 'var(--text-main)' }}>
            100% Guaranteed
          </span>
          <span className="stat-subtext">Backed by Government of India</span>
        </div>
      </div>

      {/* Donut Chart: Post Office Scheme Distribution */}
      {rawInvestments.length > 0 && (
        <div className="card-panel" style={{ padding: '28px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <span className="kicker">Scheme Distribution</span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                Allocation Across Post Office Schemes
              </h2>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Hover over sections to inspect scheme weights
            </div>
          </div>

          <PostOfficeDonutChart investments={rawInvestments} />
        </div>
      )}

      {/* Controls Bar: Search, Filters, Sorting, and View Switcher */}
      <div className="fd-controls-bar">
        <div className="controls-top-row">
          {/* Search box */}
          <div className="search-box-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by scheme name, account number, or branch..."
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
            {/* Scheme Type Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="poSchemeFilter" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Scheme:
              </label>
              <select
                id="poSchemeFilter"
                className="form-select"
                style={{ width: 'auto', minWidth: '150px', padding: '8px 12px' }}
                value={schemeFilter}
                onChange={(e) => setSchemeFilter(e.target.value)}
              >
                <option value="all">All Schemes</option>
                <option value="MIS">MIS (Monthly Income)</option>
                <option value="RD">RD (Recurring Deposit)</option>
                <option value="POTD">Time Deposit (POTD)</option>
                <option value="SCSS">Senior Citizen (SCSS)</option>
                <option value="PPF">PPF</option>
                <option value="NSC">NSC</option>
                <option value="KVP">KVP</option>
                <option value="SUKANYA">Sukanya Samriddhi</option>
                <option value="MAHILA_SAMMAN">Mahila Samman</option>
              </select>
            </div>

            {/* Sorting Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="poSortSelect" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Sort:
              </label>
              <select
                id="poSortSelect"
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
                <option value="bank-asc">Scheme Name: A to Z</option>
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
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Urgency:</span>
          <button
            type="button"
            className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Post Office ({rawInvestments.length})
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
            Maturing This Year
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
            📷 With Document
          </button>
        </div>
      </div>

      {/* Main List Render: Cards or Table */}
      {processedInvestments.length === 0 ? (
        <div className="fd-empty-state">
          <div className="empty-state-icon" style={{ background: '#FFF7ED', color: '#EA580C' }}>
            <Mail size={36} />
          </div>
          <h3 className="empty-state-title">No Post Office Investments Found</h3>
          <p className="empty-state-desc">
            {search || filter !== 'all' || schemeFilter !== 'all'
              ? 'No records match your selected filters. Try clearing search or filters.'
              : `There are no Post Office savings records recorded for ${activeMember?.name}. Click below to add the first one!`}
          </p>
          {search || filter !== 'all' || schemeFilter !== 'all' ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setFilter('all');
                setSchemeFilter('all');
              }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#EA580C', borderColor: '#C2410C' }}
              onClick={() => navigate('/add-post-office')}
            >
              <PlusCircle size={18} />
              <span>Add Post Office Scheme Now</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="fd-cards-grid">
          {processedInvestments.map((inv) => (
            <PostOfficeCard
              key={inv.id}
              investment={inv}
              onClick={() => navigate(`/post-office/${inv.id}`)}
            />
          ))}
        </div>
      ) : (
        <PostOfficeTable
          investments={processedInvestments}
          onSelect={(id) => navigate(`/post-office/${id}`)}
        />
      )}
    </div>
  );
};
