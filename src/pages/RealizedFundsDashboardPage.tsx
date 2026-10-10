import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { useDateTime } from '../context/DateTimeContext';
import { csvDb } from '../services/csvDatabase';
import { formatCurrency } from '../utils/calculations';
import {
  type RealizedTransaction,
  type RealizedFundsSourceTab,
  type RealizedFundsFilterState,
  matchesAmountRange,
  matchesDateRange
} from '../utils/realizedFundsUiHelpers';
import { RealizedFundsTable } from '../components/RealizedFundsTable';
import { RealizedFundCard } from '../components/RealizedFundCard';
import { RealizedFundsFilterPopover } from '../components/RealizedFundsFilterPopover';
import { RealizedFundDetailsPanel } from '../components/RealizedFundDetailsPanel';
import {
  Plus,
  Search,
  X,
  Wallet,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';

interface RealizedFundsDashboardPageProps {
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const SOURCE_TABS: RealizedFundsSourceTab[] = ['All', 'Asset Sales', 'Maturities'];

export const RealizedFundsDashboardPage: React.FC<RealizedFundsDashboardPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { now } = useDateTime();
  const { activeMember, members, propertyPayments } = useInvestments();

  // Selected Transaction for Slide-over Details Panel
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // Tab filter: All | Asset Sales | Maturities
  const [activeTab, setActiveTab] = useState<RealizedFundsSourceTab>('All');

  // Search query
  const [search, setSearch] = useState('');

  // Sort order
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name-asc'>('date-desc');

  // View mode: Table vs Cards
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  // Filter Popover state: Source, Family Member, Amount, Date
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<RealizedFundsFilterState>({
    source: 'all',
    memberId: 'all',
    amountRange: 'all',
    dateRange: 'all'
  });

  const handleResetFilters = () => {
    setFilters({
      source: 'all',
      memberId: 'all',
      amountRange: 'all',
      dateRange: 'all'
    });
    setActiveTab('All');
    setSearch('');
  };

  // 1. Derive all Realized Transactions directly from payments.csv and assets.csv
  // Count only records where payment_type = RECEIVED and payment_context is SALE or MATURITY
  // Exclude rent, purchase payments, pending receivables, and money not actually received
  const rawTransactions = useMemo<RealizedTransaction[]>(() => {
    const payments = (propertyPayments || csvDb.payments || []).filter(
      (p) =>
        p.payment_type === 'RECEIVED' &&
        (p.payment_context === 'SALE' || p.payment_context === 'MATURITY') &&
        (p.status === 'RECEIVED' || p.status === 'PAID')
    );

    return payments.map((p) => {
      const asset = csvDb.assets.find((a) => a.a_id === p.a_id);
      const member = members.find((m) => m.id === asset?.member_id) ||
        csvDb.familyMembers.find((m) => m.member_id === asset?.member_id);

      const source: 'Sale' | 'Maturity' = p.payment_context === 'SALE' ? 'Sale' : 'Maturity';

      let assetType: 'REAL_ESTATE' | 'FD' | 'POST_OFFICE' | 'BULLION' | 'OTHER' = 'OTHER';
      if (asset?.asset_type === 'REAL_ESTATE') assetType = 'REAL_ESTATE';
      else if (asset?.asset_type === 'FD') assetType = 'FD';
      else if (asset?.asset_type === 'POST_OFFICE') assetType = 'POST_OFFICE';
      else if (asset?.asset_type === 'BULLION') assetType = 'BULLION';

      const memberId = asset?.member_id || (member ? ('id' in member ? member.id : member.member_id) : '');
      const memberName = member ? ('name' in member ? member.name : member.member_name) : 'Family Vault';

      return {
        id: p.payment_id,
        a_id: p.a_id,
        assetName: asset?.asset_name || 'Asset',
        assetType,
        source,
        paymentContext: p.payment_context as 'SALE' | 'MATURITY',
        amount: Number(p.amount) || 0,
        paymentDate: p.payment_date || '',
        status: p.status || 'RECEIVED',
        notes: p.notes || '',
        memberId,
        memberName
      };
    });
  }, [propertyPayments, members]);

  // 2. Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    let list = [...rawTransactions];

    // Source tab filter (All | Asset Sales | Maturities)
    if (activeTab === 'Asset Sales') {
      list = list.filter((t) => t.source === 'Sale');
    } else if (activeTab === 'Maturities') {
      list = list.filter((t) => t.source === 'Maturity');
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.assetName.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.memberName.toLowerCase().includes(q) ||
          t.source.toLowerCase().includes(q)
      );
    }

    // Popover: Source filter
    if (filters.source !== 'all') {
      list = list.filter((t) => t.paymentContext === filters.source);
    }

    // Popover: Family Member filter
    if (filters.memberId !== 'all') {
      list = list.filter((t) => t.memberId === filters.memberId);
    }

    // Popover: Amount Range filter
    if (filters.amountRange !== 'all') {
      list = list.filter((t) => matchesAmountRange(t.amount, filters.amountRange));
    }

    // Popover: Date Range filter
    if (filters.dateRange !== 'all') {
      list = list.filter((t) => matchesDateRange(t.paymentDate, filters.dateRange, now));
    }

    // Sorting
    list.sort((a, b) => {
      if (sort === 'date-desc') {
        return (b.paymentDate || '').localeCompare(a.paymentDate || '');
      }
      if (sort === 'date-asc') {
        return (a.paymentDate || '').localeCompare(b.paymentDate || '');
      }
      if (sort === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (sort === 'amount-asc') {
        return a.amount - b.amount;
      }
      if (sort === 'name-asc') {
        return a.assetName.localeCompare(b.assetName);
      }
      return 0;
    });

    return list;
  }, [rawTransactions, activeTab, search, filters, sort, now]);

  // 3. Three Compact Summary Cards (Derived from money actually received)
  const totalReceived = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const salesTransactions = useMemo(() => {
    return filteredTransactions.filter((t) => t.source === 'Sale');
  }, [filteredTransactions]);

  const totalFromSales = useMemo(() => {
    return salesTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [salesTransactions]);

  const maturitiesTransactions = useMemo(() => {
    return filteredTransactions.filter((t) => t.source === 'Maturity');
  }, [filteredTransactions]);

  const totalFromMaturities = useMemo(() => {
    return maturitiesTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [maturitiesTransactions]);

  // Selected Transaction for Details Drawer
  const selectedTransaction = useMemo(() => {
    if (!selectedTransactionId) return null;
    return rawTransactions.find((t) => t.id === selectedTransactionId) || null;
  }, [rawTransactions, selectedTransactionId]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    activeTab !== 'All' ||
    filters.source !== 'all' ||
    filters.memberId !== 'all' ||
    filters.amountRange !== 'all' ||
    filters.dateRange !== 'all';

  const toastHandler = onShowToast || ((_msg, _type) => {});

  return (
    <div className="main-content fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* 1. Header: “Realized Funds” */}
      <div className="bullion-executive-header">
        <div>
          <div className="bullion-breadcrumb-text">
            <span onClick={() => navigate('/home')} className="bullion-breadcrumb-link">
              Portfolio
            </span>
            <span>/</span>
            <span>Realized Funds</span>
          </div>
          <h1 className="bullion-page-title">Realized Funds</h1>
          <p className="bullion-page-subtitle">
            Liquid proceeds received from asset sales &amp; matured investments for {activeMember?.name || 'Vault'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary bullion-primary-add-btn"
          onClick={() => navigate('/add-realized-fund')}
        >
          <Plus size={16} />
          <span>Record Fund</span>
        </button>
      </div>

      {/* 2. Three Compact Summary Cards: Total Received, From Asset Sales, From Maturities */}
      <div className="bullion-overview-grid">
        {/* Card 1: Total Received */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">Total Received</span>
          <div className="bullion-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalReceived)}
          </div>
          <div className="bullion-overview-sub">
            Across {filteredTransactions.length} realized {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>

        {/* Card 2: From Asset Sales */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">From Asset Sales</span>
          <div className="bullion-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalFromSales)}
          </div>
          <div className="bullion-overview-sub">
            {salesTransactions.length} {salesTransactions.length === 1 ? 'sale transaction' : 'sale transactions'}
          </div>
        </div>

        {/* Card 3: From Maturities */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">From Maturities</span>
          <div className="bullion-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalFromMaturities)}
          </div>
          <div className="bullion-overview-sub">
            {maturitiesTransactions.length} {maturitiesTransactions.length === 1 ? 'matured investment' : 'matured investments'}
          </div>
        </div>
      </div>

      {/* 3. Source Filter Tabs: All | Asset Sales | Maturities */}
      <div className="bullion-category-tabs-bar">
        {SOURCE_TABS.map((tab) => {
          let count = rawTransactions.length;
          if (tab === 'Asset Sales') count = rawTransactions.filter((t) => t.source === 'Sale').length;
          else if (tab === 'Maturities') count = rawTransactions.filter((t) => t.source === 'Maturity').length;

          return (
            <button
              key={tab}
              type="button"
              className={`bullion-category-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span>{tab}</span>
              <span
                style={{
                  fontSize: '11px',
                  opacity: 0.75,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === tab ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-surface-subtle)',
                  marginLeft: '4px'
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Controls Bar: Search + Compact Filter Popover + Sort + View Switcher */}
      <div className="bullion-toolbar-container">
        {/* Search */}
        <div className="bullion-search-wrapper">
          <Search size={16} className="bullion-search-icon" />
          <input
            type="text"
            className="bullion-search-input"
            placeholder="Search by asset name, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="bullion-search-clear-btn"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Actions: Clear filters, Sort select, Filter popover, View switcher */}
        <div className="bullion-toolbar-actions">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="bullion-toolbar-reset-link"
            >
              Clear filters
            </button>
          )}

          {/* Sort By Dropdown */}
          <select
            className="re-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            aria-label="Sort realized funds"
          >
            <option value="date-desc">Sort: Date (Newest First)</option>
            <option value="date-asc">Sort: Date (Oldest First)</option>
            <option value="amount-desc">Sort: Amount (High to Low)</option>
            <option value="amount-asc">Sort: Amount (Low to High)</option>
            <option value="name-asc">Sort: Asset Name (A to Z)</option>
          </select>

          {/* Compact Filter Control (Source, Family Member, Amount, Date) */}
          <RealizedFundsFilterPopover
            isOpen={isFilterOpen}
            onToggle={() => setIsFilterOpen(!isFilterOpen)}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            members={members}
          />

          {/* View Toggle (Table vs Cards) */}
          <div className="bullion-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`bullion-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="Table View"
            >
              <ListIcon size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`bullion-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              title="Cards View"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main Area: Clean Transaction List or Empty State */}
      {filteredTransactions.length === 0 ? (
        <div className="bullion-empty-container">
          <div className="bullion-empty-icon-circle">
            <Wallet size={28} color="#0F172A" />
          </div>
          <h3 className="bullion-empty-title">
            {hasActiveFilters ? 'No Matching Realized Funds' : 'No realized funds yet'}
          </h3>
          <p className="bullion-empty-subtitle">
            {hasActiveFilters
              ? 'No realized transactions matched your active filter criteria. Try resetting filters.'
              : 'Money actually received from asset sales and matured investments will appear here.'}
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
              className="btn btn-primary bullion-primary-add-btn"
              onClick={() => navigate('/add-realized-fund')}
            >
              <Plus size={16} />
              <span>Record Realized Fund</span>
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <RealizedFundsTable
          transactions={filteredTransactions}
          selectedId={selectedTransactionId}
          onSelect={(tx) => setSelectedTransactionId(tx.id)}
        />
      ) : (
        <div className="bullion-grid-layout">
          {filteredTransactions.map((tx) => (
            <RealizedFundCard
              key={tx.id}
              transaction={tx}
              isSelected={selectedTransactionId === tx.id}
              onClick={() => setSelectedTransactionId(tx.id)}
            />
          ))}
        </div>
      )}

      {/* 6. Slide-over Details Panel (Opens when transaction is clicked) */}
      {selectedTransaction && (
        <div className="bullion-drawer-backdrop fade-in" onClick={() => setSelectedTransactionId(null)}>
          <div
            className="bullion-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <RealizedFundDetailsPanel
              transaction={selectedTransaction}
              onClose={() => setSelectedTransactionId(null)}
              onShowToast={toastHandler}
              isDrawer={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
