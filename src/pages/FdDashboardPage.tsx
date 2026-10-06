import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency, formatDate, calculateFDValues } from '../utils/calculations';
import { getFdStatus, getNextMaturityInfo } from '../utils/fdUiHelpers';
import { FdCard } from '../components/FdCard';
import { FdDetailsPanel } from '../components/FdDetailsPanel';
import { FdFilterPopover, type FdFilterState } from '../components/FdFilterPopover';
import {
  Plus,
  Search,
  X,
  Landmark,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';

interface FdDashboardPageProps {
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const FdDashboardPage: React.FC<FdDashboardPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { activeMember } = useInvestments();

  // Active (non-redeemed) FDs
  const rawFds = useMemo(() => {
    return (activeMember?.fds || []).filter((f) => !f.actualEndDate && f.status !== 'redeemed');
  }, [activeMember?.fds]);

  // Selected FD for Slide-over Details Panel
  const [selectedFdId, setSelectedFdId] = useState<string | null>(null);

  // Search query
  const [search, setSearch] = useState('');

  // View mode: Cards vs List
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Unified compact filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FdFilterState>({
    bank: 'all',
    status: 'all',
    amountRange: 'all',
    maturityRange: 'all',
    rateRange: 'all'
  });

  const handleResetFilters = () => {
    setFilters({
      bank: 'all',
      status: 'all',
      amountRange: 'all',
      maturityRange: 'all',
      rateRange: 'all'
    });
    setSearch('');
  };

  // Distinct banks for filter dropdown
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    rawFds.forEach((f) => {
      if (f.bankName && f.bankName.trim()) set.add(f.bankName.trim());
    });
    return Array.from(set).sort();
  }, [rawFds]);

  // 1. Compact Overview: Total FD Value
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

  // 2. Compact Overview: Next Maturity
  const nextMaturity = useMemo(() => {
    return getNextMaturityInfo(rawFds);
  }, [rawFds]);

  // Filtered FDs
  const filteredFds = useMemo(() => {
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

    // Bank filter
    if (filters.bank !== 'all') {
      list = list.filter((f) => f.bankName.toLowerCase() === filters.bank.toLowerCase());
    }

    // Status filter
    if (filters.status !== 'all') {
      list = list.filter((f) => {
        const st = getFdStatus(f.maturityDate, f.actualEndDate, f.status);
        if (filters.status === 'safe') return st.type === 'safe';
        if (filters.status === 'approaching') return st.type === 'approaching';
        if (filters.status === 'due') return st.type === 'due' || st.type === 'overdue';
        return true;
      });
    }

    // Amount range filter
    if (filters.amountRange !== 'all') {
      list = list.filter((f) => {
        const amt = Number(f.principal) || 0;
        if (filters.amountRange === 'under_1l') return amt < 100000;
        if (filters.amountRange === '1l_5l') return amt >= 100000 && amt <= 500000;
        if (filters.amountRange === '5l_10l') return amt > 500000 && amt <= 1000000;
        if (filters.amountRange === 'above_10l') return amt > 1000000;
        return true;
      });
    }

    // Maturity schedule filter
    if (filters.maturityRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      list = list.filter((f) => {
        if (!f.maturityDate) return false;
        const mat = new Date(f.maturityDate);
        mat.setHours(0, 0, 0, 0);
        const diffDays = Math.round((mat.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (filters.maturityRange === 'next_30d') return diffDays <= 30;
        if (filters.maturityRange === 'next_90d') return diffDays <= 90;
        if (filters.maturityRange === 'next_180d') return diffDays <= 180;
        if (filters.maturityRange === 'next_365d') return diffDays <= 365;
        if (filters.maturityRange === 'over_1y') return diffDays > 365;
        return true;
      });
    }

    // Interest rate filter
    if (filters.rateRange !== 'all') {
      list = list.filter((f) => {
        const rate = Number(f.interestRate) || 0;
        if (filters.rateRange === 'above_7_5') return rate >= 7.5;
        if (filters.rateRange === '7_to_7_5') return rate >= 7.0 && rate < 7.5;
        if (filters.rateRange === 'under_7') return rate < 7.0;
        return true;
      });
    }

    // Sort earliest maturity first by default
    list.sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());

    return list;
  }, [rawFds, search, filters]);

  const selectedFd = useMemo(() => {
    if (!selectedFdId) return null;
    return rawFds.find((f) => f.id === selectedFdId) || null;
  }, [rawFds, selectedFdId]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    filters.bank !== 'all' ||
    filters.status !== 'all' ||
    filters.amountRange !== 'all' ||
    filters.maturityRange !== 'all' ||
    filters.rateRange !== 'all';

  const toastHandler = onShowToast || ((_msg, _type) => {});

  return (
    <div className="main-content fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* 1. Header: “Fixed Deposits” + primary “+ Add FD” button */}
      <div className="fd-executive-header">
        <div>
          <div className="fd-breadcrumb-text">
            <span onClick={() => navigate('/home')} className="fd-breadcrumb-link">
              Portfolio
            </span>
            <span>/</span>
            <span>Fixed Deposits</span>
          </div>
          <h1 className="fd-page-title">Fixed Deposits</h1>
          <p className="fd-page-subtitle">
            Active deposits for {activeMember?.name || 'User'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary fd-primary-add-btn"
          onClick={() => navigate('/add-fd')}
        >
          <Plus size={16} />
          <span>Add FD</span>
        </button>
      </div>

      {/* 2. Compact Overview: Total FD Value, Active FDs, Next Maturity */}
      <div className="fd-overview-grid">
        {/* Card 1: Total FD Value */}
        <div className="fd-overview-card">
          <span className="fd-overview-kicker">Total FD Value</span>
          <div className="fd-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalPrincipal)}
          </div>
          <div className="fd-overview-sub">
            +₹ {formatCurrency(totalInterestGain)} returns · Matures to ₹ {formatCurrency(totalMaturityPayout)}
          </div>
        </div>

        {/* Card 2: Active FDs */}
        <div className="fd-overview-card">
          <span className="fd-overview-kicker">Active FDs</span>
          <div className="fd-overview-value">
            {rawFds.length}
            <span className="fd-overview-unit">Deposits</span>
          </div>
          <div className="fd-overview-sub">
            Weighted avg: {avgInterestRate}% p.a. yield
          </div>
        </div>

        {/* Card 3: Next Maturity */}
        <div className="fd-overview-card">
          <span className="fd-overview-kicker">Next Maturity</span>
          <div className="fd-overview-value" style={{ fontSize: nextMaturity.dateStr ? '22px' : '26px' }}>
            {nextMaturity.dateStr ? formatDate(nextMaturity.dateStr) : 'None'}
          </div>
          <div className="fd-overview-sub">
            {nextMaturity.status ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: nextMaturity.status.dotColor
                  }}
                />
                <span style={{ color: nextMaturity.status.textColor, fontWeight: 600 }}>
                  {nextMaturity.daysLeft !== null && nextMaturity.daysLeft >= 0
                    ? `In ${nextMaturity.daysLeft} days (${nextMaturity.status.label})`
                    : nextMaturity.status.label}
                </span>
              </span>
            ) : (
              'No upcoming dates'
            )}
          </div>
        </div>
      </div>

      {/* 3. Controls Bar: Compact Search + Unified Filter Control + View Switcher */}
      <div className="fd-toolbar-container">
        {/* Left: Search input */}
        <div className="fd-search-wrapper">
          <Search size={16} className="fd-search-icon" />
          <input
            type="text"
            className="fd-search-input"
            placeholder="Search by bank or account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="fd-search-clear-btn"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right: Unified compact Filter popover + View toggle */}
        <div className="fd-toolbar-actions">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="fd-toolbar-reset-link"
            >
              Clear filters
            </button>
          )}

          {/* Compact Filter Control */}
          <FdFilterPopover
            isOpen={isFilterOpen}
            onToggle={() => setIsFilterOpen(!isFilterOpen)}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            availableBanks={availableBanks}
          />

          {/* Cards vs List Switcher */}
          <div className="fd-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`fd-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`fd-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="List View"
            >
              <ListIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Area: Clean FD Cards or List / Empty State */}
      {filteredFds.length === 0 ? (
        <div className="fd-empty-container">
          <div className="fd-empty-icon-circle">
            <Landmark size={28} color="#0F172A" />
          </div>
          <h3 className="fd-empty-title">
            {hasActiveFilters ? 'No Matching Fixed Deposits' : 'No FDs yet'}
          </h3>
          <p className="fd-empty-subtitle">
            {hasActiveFilters
              ? 'No deposits matched the active filter criteria. Try resetting filters.'
              : 'Add your first fixed deposit to start tracking principal and maturity dates.'}
          </p>

          {hasActiveFilters ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary fd-primary-add-btn"
              onClick={() => navigate('/add-fd')}
            >
              <Plus size={16} />
              <span>Add FD</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="fd-grid-layout">
          {filteredFds.map((fd) => (
            <FdCard
              key={fd.id}
              fd={fd}
              isSelected={selectedFdId === fd.id}
              onClick={() => setSelectedFdId(fd.id)}
            />
          ))}
        </div>
      ) : (
        <div className="fd-list-layout">
          {filteredFds.map((fd) => (
            <FdCard
              key={fd.id}
              fd={fd}
              isSelected={selectedFdId === fd.id}
              onClick={() => setSelectedFdId(fd.id)}
            />
          ))}
        </div>
      )}

      {/* 5. Slide-over Details Panel (Opens when card is clicked) */}
      {selectedFd && (
        <div className="fd-drawer-backdrop fade-in" onClick={() => setSelectedFdId(null)}>
          <div
            className="fd-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <FdDetailsPanel
              fd={selectedFd}
              onClose={() => setSelectedFdId(null)}
              onShowToast={toastHandler}
              isDrawer={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
