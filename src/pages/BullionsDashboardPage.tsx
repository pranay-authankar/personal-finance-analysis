import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { ViewMode } from '../types';
import { formatCurrency } from '../utils/calculations';
import { getEffectiveBullionValue, hasSufficientValue } from '../utils/bullionCalculations';
import { BullionCard } from '../components/BullionCard';
import { BullionTable } from '../components/BullionTable';
import { BullionDonutChart } from '../components/BullionDonutChart';
import {
  PlusCircle,
  Search,
  X,
  LayoutGrid,
  Table as TableIcon,
  Coins,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export const BullionsDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeMember } = useInvestments();

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'needs-verification'>('all');
  const [sort, setSort] = useState<string>('value-desc');
  const [search, setSearch] = useState('');

  // Only active holdings are displayed in the current investment section
  const rawInvestments = useMemo(() => {
    return (activeMember?.bullionsInvestments || []).filter((b) => !b.status || b.status === 'active');
  }, [activeMember?.bullionsInvestments]);

  // Summary Metrics calculations
  const { totalVerifiedValue, verifiedCount, unverifiedCount } = useMemo(() => {
    let total = 0;
    let verified = 0;
    let unverified = 0;

    rawInvestments.forEach((b) => {
      if (hasSufficientValue(b)) {
        total += getEffectiveBullionValue(b);
        verified += 1;
      } else {
        unverified += 1;
      }
    });

    return {
      totalVerifiedValue: total,
      verifiedCount: verified,
      unverifiedCount: unverified
    };
  }, [rawInvestments]);

  // Filtering & Sorting
  const processedInvestments = useMemo(() => {
    let list = [...rawInvestments];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.itemName.toLowerCase().includes(q) ||
          b.typeName.toLowerCase().includes(q) ||
          (b.notes && b.notes.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter((b) => b.type === typeFilter);
    }

    // Status filter
    if (statusFilter === 'verified') {
      list = list.filter(hasSufficientValue);
    } else if (statusFilter === 'needs-verification') {
      list = list.filter((b) => !hasSufficientValue(b));
    }

    // Sorting
    list.sort((a, b) => {
      const valA = getEffectiveBullionValue(a);
      const valB = getEffectiveBullionValue(b);

      if (sort === 'value-desc') {
        return valB - valA;
      } else if (sort === 'value-asc') {
        return valA - valB;
      } else if (sort === 'date-desc') {
        return new Date(b.purchaseDate || '1970').getTime() - new Date(a.purchaseDate || '1970').getTime();
      } else if (sort === 'date-asc') {
        return new Date(a.purchaseDate || '2099').getTime() - new Date(b.purchaseDate || '2099').getTime();
      } else if (sort === 'weight-desc') {
        return (Number(b.weightGrams) || 0) - (Number(a.weightGrams) || 0);
      } else if (sort === 'rate-desc') {
        return (Number(b.purchaseRate) || 0) - (Number(a.purchaseRate) || 0);
      } else if (sort === 'name-asc') {
        return a.itemName.localeCompare(b.itemName);
      }
      return 0;
    });

    return list;
  }, [rawInvestments, search, typeFilter, statusFilter, sort]);

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
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Bullions</span>
          </nav>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            Bullions &amp; Precious Metals Vault
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Viewing physical &amp; sovereign gold, silver, and precious holdings for <strong>{activeMember?.name}</strong> ({activeMember?.role})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: '#D97706', borderColor: '#B45309' }}
            onClick={() => navigate('/add-bullion')}
          >
            <PlusCircle size={18} />
            <span>Add Bullion Asset</span>
          </button>
        </div>
      </div>

      {/* Top Bullions Summary Metrics Grid */}
      <div className="fd-summary-stats-grid">
        <div className="stat-metric-card" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <span className="stat-kicker">Total Bullions Investment Value</span>
          <span className="stat-number" style={{ color: '#D97706' }}>
            ₹ {formatCurrency(totalVerifiedValue)}
          </span>
          <span className="stat-subtext">
            {verifiedCount} verified {verifiedCount === 1 ? 'asset' : 'assets'} with recorded value
          </span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Verified Holdings</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span className="stat-number" style={{ color: 'var(--color-emerald)' }}>
              {verifiedCount}
            </span>
            <CheckCircle size={20} color="var(--color-emerald)" />
          </div>
          <span className="stat-subtext">Included in portfolio net worth</span>
        </div>

        <div className="stat-metric-card" style={{ background: unverifiedCount > 0 ? '#FFFBEB' : 'white', borderColor: unverifiedCount > 0 ? '#FCD34D' : 'var(--border-light)' }}>
          <span className="stat-kicker">Needs Verification Soon</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span className="stat-number" style={{ color: unverifiedCount > 0 ? '#B45309' : 'var(--text-muted)' }}>
              {unverifiedCount}
            </span>
            {unverifiedCount > 0 && <AlertCircle size={20} color="#B45309" />}
          </div>
          <span className="stat-subtext">
            {unverifiedCount > 0 ? 'Missing price/weight info (excluded from totals)' : 'All assets have verified values'}
          </span>
        </div>

        <div className="stat-metric-card">
          <span className="stat-kicker">Asset Classes</span>
          <span className="stat-number" style={{ fontSize: '20px', color: 'var(--text-main)' }}>
            Gold · Silver · Platinum
          </span>
          <span className="stat-subtext">Inflation hedge &amp; store of value</span>
        </div>
      </div>

      {/* Donut Chart: Bullion Value Distribution */}
      {verifiedCount > 0 && (
        <div className="card-panel" style={{ padding: '28px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <span className="kicker">Value Distribution</span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                Recorded Bullion Allocation by Metal Type
              </h2>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Only assets with verified value contribute to this chart
            </div>
          </div>

          <BullionDonutChart investments={rawInvestments} />
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
              placeholder="Search by item name, metal type, or notes..."
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
            {/* Bullion Type Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="bullionTypeFilter" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Metal:
              </label>
              <select
                id="bullionTypeFilter"
                className="form-select"
                style={{ width: 'auto', minWidth: '150px', padding: '8px 12px' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Metals</option>
                <option value="GOLD">🪙 Gold</option>
                <option value="SILVER">🥈 Silver</option>
                <option value="PLATINUM">💍 Platinum</option>
                <option value="OTHER">💎 Other</option>
              </select>
            </div>

            {/* Sorting Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="bullionSortSelect" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Sort:
              </label>
              <select
                id="bullionSortSelect"
                className="form-select"
                style={{ width: 'auto', minWidth: '180px', padding: '8px 12px' }}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="value-desc">Value: Highest First</option>
                <option value="value-asc">Value: Lowest First</option>
                <option value="date-desc">Purchase Date: Latest First</option>
                <option value="date-asc">Purchase Date: Earliest First</option>
                <option value="weight-desc">Weight: Highest First</option>
                <option value="rate-desc">Purchase Rate: Highest First</option>
                <option value="name-asc">Item Name: A to Z</option>
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
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Record Status:</span>
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Holdings ({rawInvestments.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'verified' ? 'active' : ''}`}
            onClick={() => setStatusFilter('verified')}
          >
            ✓ Verified Value Only ({verifiedCount})
          </button>
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'needs-verification' ? 'active' : ''}`}
            onClick={() => setStatusFilter('needs-verification')}
          >
            ⚠️ Needs Verification Soon ({unverifiedCount})
          </button>
        </div>
      </div>

      {/* Main List Render: Cards or Table */}
      {processedInvestments.length === 0 ? (
        <div className="fd-empty-state">
          <div className="empty-state-icon" style={{ background: '#FFFBEB', color: '#D97706' }}>
            <Coins size={36} />
          </div>
          <h3 className="empty-state-title">No Bullion Assets Found</h3>
          <p className="empty-state-desc">
            {search || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No bullion holdings match your selected filters. Try clearing filters.'
              : `There are no precious metal records added for ${activeMember?.name}. Click below to add gold, silver, or platinum investments.`}
          </p>
          {search || typeFilter !== 'all' || statusFilter !== 'all' ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#D97706', borderColor: '#B45309' }}
              onClick={() => navigate('/add-bullion')}
            >
              <PlusCircle size={18} />
              <span>Add Bullion Holding Now</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="fd-cards-grid">
          {processedInvestments.map((b) => (
            <BullionCard
              key={b.id}
              investment={b}
              onClick={() => navigate(`/bullions/${b.id}`)}
            />
          ))}
        </div>
      ) : (
        <BullionTable
          investments={processedInvestments}
          onSelect={(id) => navigate(`/bullions/${id}`)}
        />
      )}
    </div>
  );
};
