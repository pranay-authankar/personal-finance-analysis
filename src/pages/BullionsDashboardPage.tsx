import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { BullionInvestment } from '../types';
import { formatCurrency } from '../utils/calculations';
import { getEffectiveBullionValue } from '../utils/bullionCalculations';
import {
  type BullionCategoryTab,
  type BullionFilterState,
  getBullionCategory
} from '../utils/bullionUiHelpers';
import { BullionCard } from '../components/BullionCard';
import { BullionDetailsPanel } from '../components/BullionDetailsPanel';
import { BullionFilterPopover } from '../components/BullionFilterPopover';
import { AddBullionModal } from '../components/AddBullionModal';
import {
  Plus,
  Search,
  X,
  Coins,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';

interface BullionsDashboardPageProps {
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const CATEGORY_TABS: BullionCategoryTab[] = ['All', 'Gold', 'Silver', 'Diamonds', 'Stones', 'Other'];

export const BullionsDashboardPage: React.FC<BullionsDashboardPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { activeMember } = useInvestments();

  // All bullion records for active member (both held and sold)
  const rawInvestments = useMemo(() => {
    return activeMember?.bullionsInvestments || [];
  }, [activeMember?.bullionsInvestments]);

  // Selected Bullion for Slide-over Details Panel
  const [selectedBullionId, setSelectedBullionId] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [bullionToEdit, setBullionToEdit] = useState<BullionInvestment | null>(null);

  // Filter tab: All | Gold | Silver | Diamonds | Stones | Other
  const [activeTab, setActiveTab] = useState<BullionCategoryTab>('All');

  // Search query
  const [search, setSearch] = useState('');

  // View mode: Cards vs List
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Filter Popover state: Status & Purchase Value
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<BullionFilterState>({
    status: 'all',
    valueRange: 'all'
  });

  const handleResetFilters = () => {
    setFilters({
      status: 'all',
      valueRange: 'all'
    });
    setActiveTab('All');
    setSearch('');
  };

  // 1. Three compact summary metrics: Total Purchase Value, Assets Held, Assets Sold
  const heldInvestments = useMemo(() => {
    return rawInvestments.filter((b) => b.status !== 'sold');
  }, [rawInvestments]);

  const soldInvestments = useMemo(() => {
    return rawInvestments.filter((b) => b.status === 'sold');
  }, [rawInvestments]);

  const totalHeldPurchaseValue = useMemo(() => {
    return heldInvestments.reduce((sum, b) => sum + getEffectiveBullionValue(b), 0);
  }, [heldInvestments]);

  // Filtering & Sorting
  const filteredInvestments = useMemo(() => {
    let list = [...rawInvestments];

    // Category tab filter
    if (activeTab !== 'All') {
      list = list.filter((b) => getBullionCategory(b) === activeTab);
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (b) =>
          (b.itemName && b.itemName.toLowerCase().includes(q)) ||
          (b.typeName && b.typeName.toLowerCase().includes(q)) ||
          (b.type && b.type.toLowerCase().includes(q)) ||
          (b.notes && b.notes.toLowerCase().includes(q))
      );
    }

    // Popover: Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'held') {
        list = list.filter((b) => b.status !== 'sold');
      } else if (filters.status === 'sold') {
        list = list.filter((b) => b.status === 'sold');
      }
    }

    // Popover: Purchase Value Range filter
    if (filters.valueRange !== 'all') {
      list = list.filter((b) => {
        const val = getEffectiveBullionValue(b);
        if (filters.valueRange === 'under_50k') return val > 0 && val < 50000;
        if (filters.valueRange === '50k_2l') return val >= 50000 && val <= 200000;
        if (filters.valueRange === '2l_5l') return val > 200000 && val <= 500000;
        if (filters.valueRange === 'above_5l') return val > 500000;
        return true;
      });
    }

    // Sort: Active held first, then latest purchase date / highest value
    list.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'sold' ? 1 : -1;
      }
      const valA = getEffectiveBullionValue(a);
      const valB = getEffectiveBullionValue(b);
      return valB - valA;
    });

    return list;
  }, [rawInvestments, activeTab, search, filters]);

  const selectedBullion = useMemo(() => {
    if (!selectedBullionId) return null;
    return rawInvestments.find((b) => b.id === selectedBullionId) || null;
  }, [rawInvestments, selectedBullionId]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    activeTab !== 'All' ||
    filters.status !== 'all' ||
    filters.valueRange !== 'all';

  const toastHandler = onShowToast || ((_msg, _type) => {});

  const handleOpenAddModal = () => {
    setBullionToEdit(null);
    setIsAddModalOpen(true);
  };

  const handleEditFromPanel = (b: BullionInvestment) => {
    setSelectedBullionId(null);
    setBullionToEdit(b);
    setIsAddModalOpen(true);
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* 1. Header: “Bullions” + “+ Add Asset” */}
      <div className="bullion-executive-header">
        <div>
          <div className="bullion-breadcrumb-text">
            <span onClick={() => navigate('/home')} className="bullion-breadcrumb-link">
              Portfolio
            </span>
            <span>/</span>
            <span>Bullions</span>
          </div>
          <h1 className="bullion-page-title">Bullions</h1>
          <p className="bullion-page-subtitle">
            Precious metals &amp; stones for {activeMember?.name || 'User'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary bullion-primary-add-btn"
          onClick={handleOpenAddModal}
        >
          <Plus size={16} />
          <span>Add Asset</span>
        </button>
      </div>

      {/* 2. Three compact summary cards: Total Purchase Value, Assets Held, Assets Sold */}
      <div className="bullion-overview-grid">
        {/* Card 1: Total Purchase Value */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">Total Purchase Value</span>
          <div className="bullion-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalHeldPurchaseValue)}
          </div>
          <div className="bullion-overview-sub">
            Across {heldInvestments.length} active holdings
          </div>
        </div>

        {/* Card 2: Assets Held */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">Assets Held</span>
          <div className="bullion-overview-value">
            {heldInvestments.length}
            <span className="bullion-overview-unit">Assets</span>
          </div>
          <div className="bullion-overview-sub">
            Active in physical custody
          </div>
        </div>

        {/* Card 3: Assets Sold */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">Assets Sold</span>
          <div className="bullion-overview-value">
            {soldInvestments.length}
            <span className="bullion-overview-unit">Assets</span>
          </div>
          <div className="bullion-overview-sub">
            Liquidated / realized funds
          </div>
        </div>
      </div>

      {/* 3. Simple filter tabs: All | Gold | Silver | Diamonds | Stones | Other */}
      <div className="bullion-category-tabs-bar">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`bullion-category-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <span>{tab === 'All' ? 'All' : tab}</span>
          </button>
        ))}
      </div>

      {/* 4. Controls Bar: Search + Simple Filter Control for Status & Purchase Value + View Switcher */}
      <div className="bullion-toolbar-container">
        {/* Search */}
        <div className="bullion-search-wrapper">
          <Search size={16} className="bullion-search-icon" />
          <input
            type="text"
            className="bullion-search-input"
            placeholder="Search by item name or type..."
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

        {/* Actions: Clear filters, Filter popover, View switcher */}
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

          {/* Simple filter control for Status and Purchase Value */}
          <BullionFilterPopover
            isOpen={isFilterOpen}
            onToggle={() => setIsFilterOpen(!isFilterOpen)}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
          />

          {/* View Toggle */}
          <div className="bullion-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`bullion-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`bullion-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="List View"
            >
              <ListIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main Area: Clean Cards / Compact Grid or Empty State */}
      {filteredInvestments.length === 0 ? (
        <div className="bullion-empty-container">
          <div className="bullion-empty-icon-circle">
            <Coins size={28} color="#0F172A" />
          </div>
          <h3 className="bullion-empty-title">
            {hasActiveFilters ? 'No Matching Bullion Assets' : 'No bullion assets yet'}
          </h3>
          <p className="bullion-empty-subtitle">
            {hasActiveFilters
              ? 'No assets matched your active filter criteria. Try resetting filters.'
              : 'Add gold, silver, diamonds, or precious stones to begin tracking.'}
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
              onClick={handleOpenAddModal}
            >
              <Plus size={16} />
              <span>+ Add Asset</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="bullion-grid-layout">
          {filteredInvestments.map((b) => (
            <BullionCard
              key={b.id}
              investment={b}
              isSelected={selectedBullionId === b.id}
              onClick={() => setSelectedBullionId(b.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bullion-list-layout">
          {filteredInvestments.map((b) => (
            <BullionCard
              key={b.id}
              investment={b}
              isSelected={selectedBullionId === b.id}
              onClick={() => setSelectedBullionId(b.id)}
            />
          ))}
        </div>
      )}

      {/* 6. Slide-over Details Panel (Opens when card is clicked) */}
      {selectedBullion && (
        <div className="bullion-drawer-backdrop fade-in" onClick={() => setSelectedBullionId(null)}>
          <div
            className="bullion-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <BullionDetailsPanel
              investment={selectedBullion}
              onClose={() => setSelectedBullionId(null)}
              onEdit={handleEditFromPanel}
              onShowToast={toastHandler}
              isDrawer={true}
            />
          </div>
        </div>
      )}

      {/* 7. Compact Add / Edit Asset Modal */}
      <AddBullionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setBullionToEdit(null);
        }}
        bullionToEdit={bullionToEdit}
        onShowToast={toastHandler}
        onSaved={(saved) => {
          setSelectedBullionId(saved.id);
        }}
      />
    </div>
  );
};
