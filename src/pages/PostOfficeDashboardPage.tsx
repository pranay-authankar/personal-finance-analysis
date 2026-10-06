import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { formatCurrency, formatDate } from '../utils/calculations';
import { getPostOfficeStatus, getNextPostOfficeDueInfo } from '../utils/postOfficeUiHelpers';
import { PostOfficeCard } from '../components/PostOfficeCard';
import { PostOfficeDetailsPanel } from '../components/PostOfficeDetailsPanel';
import { PostOfficeFilterPopover, type PostOfficeFilterState } from '../components/PostOfficeFilterPopover';
import {
  Plus,
  Search,
  X,
  Mail,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';

interface PostOfficeDashboardPageProps {
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const PostOfficeDashboardPage: React.FC<PostOfficeDashboardPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { activeMember } = useInvestments();

  // Active (non-closed/non-redeemed) investments
  const rawInvestments = useMemo(() => {
    return (activeMember?.postOfficeInvestments || []).filter(
      (inv) => !inv.actualEndDate && inv.status !== 'closed' && inv.status !== 'redeemed'
    );
  }, [activeMember?.postOfficeInvestments]);

  // Selected for Slide-over Details Panel
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  // Scheme selector: All | TD | MIS | RD | SCSS
  const [selectedSchemeTab, setSelectedSchemeTab] = useState<string>('All');

  // Search query
  const [search, setSearch] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<PostOfficeFilterState>({
    scheme: 'all',
    status: 'all',
    amountRange: 'all',
    maturityRange: 'all'
  });

  const handleResetFilters = () => {
    setFilters({
      scheme: 'all',
      status: 'all',
      amountRange: 'all',
      maturityRange: 'all'
    });
    setSelectedSchemeTab('All');
    setSearch('');
  };

  // 1. Compact Overview: Total Value
  const totalValue = useMemo(() => {
    return rawInvestments.reduce((sum, inv) => {
      if (inv.schemeType === 'RD') {
        return sum + (Number(inv.totalDepositedAmount) || Number(inv.amount) || 0);
      }
      return sum + (Number(inv.amount) || 0);
    }, 0);
  }, [rawInvestments]);

  // 2. Compact Overview: Next Due
  const nextDueInfo = useMemo(() => {
    return getNextPostOfficeDueInfo(rawInvestments);
  }, [rawInvestments]);

  // Filtering
  const filteredInvestments = useMemo(() => {
    let list = [...rawInvestments];

    // Scheme selector tab
    if (selectedSchemeTab !== 'All') {
      list = list.filter((i) => {
        if (selectedSchemeTab === 'TD') return i.schemeType === 'TD' || (i.schemeType as string) === 'POTD';
        return i.schemeType === selectedSchemeTab;
      });
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.schemeName.toLowerCase().includes(q) ||
          i.accountNumber.toLowerCase().includes(q)
      );
    }

    // Filter Popover: Scheme
    if (filters.scheme !== 'all') {
      list = list.filter((i) => {
        if (filters.scheme === 'TD') return i.schemeType === 'TD' || (i.schemeType as string) === 'POTD';
        return i.schemeType === filters.scheme;
      });
    }

    // Filter Popover: Status
    if (filters.status !== 'all') {
      list = list.filter((i) => {
        const st = getPostOfficeStatus(i);
        if (filters.status === 'safe') return st.type === 'safe';
        if (filters.status === 'approaching') return st.type === 'approaching' || st.type === 'pending';
        if (filters.status === 'due') return st.type === 'due' || st.type === 'overdue';
        if (filters.status === 'missed') return st.type === 'missed';
        return true;
      });
    }

    // Filter Popover: Amount Range
    if (filters.amountRange !== 'all') {
      list = list.filter((i) => {
        const amt = i.schemeType === 'RD' ? (i.monthlyDeposit || 0) : (Number(i.amount) || 0);
        if (filters.amountRange === 'under_1l') return amt < 100000;
        if (filters.amountRange === '1l_5l') return amt >= 100000 && amt <= 500000;
        if (filters.amountRange === '5l_10l') return amt > 500000 && amt <= 1000000;
        if (filters.amountRange === 'above_10l') return amt > 1000000;
        return true;
      });
    }

    // Filter Popover: Maturity Range
    if (filters.maturityRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      list = list.filter((i) => {
        if (!i.maturityDate) return false;
        const mat = new Date(i.maturityDate);
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

    // Default sort by maturity date ascending
    list.sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());

    return list;
  }, [rawInvestments, selectedSchemeTab, search, filters]);

  const selectedInvestment = useMemo(() => {
    if (!selectedPoId) return null;
    return rawInvestments.find((i) => i.id === selectedPoId) || null;
  }, [rawInvestments, selectedPoId]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedSchemeTab !== 'All' ||
    filters.scheme !== 'all' ||
    filters.status !== 'all' ||
    filters.amountRange !== 'all' ||
    filters.maturityRange !== 'all';

  const toastHandler = onShowToast || ((_msg, _type) => {});

  return (
    <div className="main-content fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* 1. Header: “Post Office” + “+ Add Scheme” */}
      <div className="po-executive-header">
        <div>
          <div className="po-breadcrumb-text">
            <span onClick={() => navigate('/home')} className="po-breadcrumb-link">
              Portfolio
            </span>
            <span>/</span>
            <span>Post Office</span>
          </div>
          <h1 className="po-page-title">Post Office</h1>
          <p className="po-page-subtitle">
            Small savings schemes for {activeMember?.name || 'User'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary po-primary-add-btn"
          onClick={() => navigate('/add-post-office')}
        >
          <Plus size={16} />
          <span>Add Scheme</span>
        </button>
      </div>

      {/* 2. Compact Overview: Total Value, Active Schemes, Next Due */}
      <div className="po-overview-grid">
        {/* Card 1: Total Value */}
        <div className="po-overview-card">
          <span className="po-overview-kicker">Total Value</span>
          <div className="po-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalValue)}
          </div>
          <div className="po-overview-sub">
            Government sovereign backed
          </div>
        </div>

        {/* Card 2: Active Schemes */}
        <div className="po-overview-card">
          <span className="po-overview-kicker">Active Schemes</span>
          <div className="po-overview-value">
            {rawInvestments.length}
            <span className="po-overview-unit">Accounts</span>
          </div>
          <div className="po-overview-sub">
            TD, MIS, RD &amp; SCSS portfolios
          </div>
        </div>

        {/* Card 3: Next Due */}
        <div className="po-overview-card">
          <span className="po-overview-kicker">Next Due</span>
          <div className="po-overview-value" style={{ fontSize: nextDueInfo.dateStr ? '20px' : '26px' }}>
            {nextDueInfo.dateStr ? formatDate(nextDueInfo.dateStr) : 'None'}
          </div>
          <div className="po-overview-sub">
            {nextDueInfo.status ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: nextDueInfo.status.dotColor
                  }}
                />
                <span style={{ color: nextDueInfo.status.textColor, fontWeight: 600 }}>
                  {nextDueInfo.title}
                  {nextDueInfo.daysLeft !== null && nextDueInfo.daysLeft >= 0
                    ? ` (in ${nextDueInfo.daysLeft}d)`
                    : ''}
                </span>
              </span>
            ) : (
              'No upcoming dates'
            )}
          </div>
        </div>
      </div>

      {/* 3. Scheme Selector: All | TD | MIS | RD | SCSS */}
      <div className="po-scheme-selector-bar">
        {['All', 'TD', 'MIS', 'RD', 'SCSS'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`po-scheme-tab ${selectedSchemeTab === tab ? 'active' : ''}`}
            onClick={() => setSelectedSchemeTab(tab)}
          >
            <span>{tab === 'All' ? 'All Schemes' : tab}</span>
          </button>
        ))}
      </div>

      {/* 4. Controls Bar: Search + Compact Filter + View Switcher */}
      <div className="po-toolbar-container">
        {/* Search */}
        <div className="po-search-wrapper">
          <Search size={16} className="po-search-icon" />
          <input
            type="text"
            className="po-search-input"
            placeholder="Search by scheme or account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="po-search-clear-btn"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Toolbar Actions */}
        <div className="po-toolbar-actions">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="po-toolbar-reset-link"
            >
              Clear filters
            </button>
          )}

          {/* Compact Filter Popover */}
          <PostOfficeFilterPopover
            isOpen={isFilterOpen}
            onToggle={() => setIsFilterOpen(!isFilterOpen)}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
          />

          {/* View Toggle */}
          <div className="po-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`po-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`po-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="List View"
            >
              <ListIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main Area: Clean Scheme Cards or Empty State */}
      {filteredInvestments.length === 0 ? (
        <div className="po-empty-container">
          <div className="po-empty-icon-circle">
            <Mail size={28} color="#0F172A" />
          </div>
          <h3 className="po-empty-title">
            {hasActiveFilters ? 'No Matching Investments' : 'No Post Office investments'}
          </h3>
          <p className="po-empty-subtitle">
            {hasActiveFilters
              ? 'No schemes matched your active filter criteria. Try resetting filters.'
              : 'Add your first Post Office deposit scheme to track safe government yields.'}
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
              className="btn btn-primary po-primary-add-btn"
              onClick={() => navigate('/add-post-office')}
            >
              <Plus size={16} />
              <span>Add Scheme</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="po-grid-layout">
          {filteredInvestments.map((inv) => (
            <PostOfficeCard
              key={inv.id}
              investment={inv}
              isSelected={selectedPoId === inv.id}
              onClick={() => setSelectedPoId(inv.id)}
            />
          ))}
        </div>
      ) : (
        <div className="po-list-layout">
          {filteredInvestments.map((inv) => (
            <PostOfficeCard
              key={inv.id}
              investment={inv}
              isSelected={selectedPoId === inv.id}
              onClick={() => setSelectedPoId(inv.id)}
            />
          ))}
        </div>
      )}

      {/* 6. Slide-over Details Panel */}
      {selectedInvestment && (
        <div className="po-drawer-backdrop fade-in" onClick={() => setSelectedPoId(null)}>
          <div
            className="po-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <PostOfficeDetailsPanel
              investment={selectedInvestment}
              onClose={() => setSelectedPoId(null)}
              onShowToast={toastHandler}
              isDrawer={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
