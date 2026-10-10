import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { useDateTime } from '../context/DateTimeContext';
import type { PropertyRecord } from '../types';
import { formatCurrency } from '../utils/calculations';
import {
  type RealEstateCategoryTab,
  type RealEstateFilterState,
  getRealEstateCategory
} from '../utils/realEstateUiHelpers';
import { RealEstateCard } from '../components/RealEstateCard';
import { RealEstateDetailsPanel } from '../components/RealEstateDetailsPanel';
import { RealEstateFilterPopover } from '../components/RealEstateFilterPopover';
import { AddPropertyModal } from '../components/AddPropertyModal';
import {
  Plus,
  Search,
  X,
  Building,
  LayoutGrid,
  List as ListIcon,
  Clock
} from 'lucide-react';

interface RealEstateDashboardPageProps {
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

const CATEGORY_TABS: RealEstateCategoryTab[] = ['All', 'Land', 'Commercial', 'Private House'];

export const RealEstateDashboardPage: React.FC<RealEstateDashboardPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { now, midnightTicker } = useDateTime();
  const {
    activeMember,
    properties: allProperties,
    rents,
    getActiveRentForProperty,
    calculatePropertyFinances
  } = useInvestments();

  // All properties for active member (or all vault properties)
  const properties = useMemo(() => {
    if (activeMember?.id && activeMember.properties && activeMember.properties.length > 0) {
      return activeMember.properties.filter((p) => p.property_status !== 'DELETED');
    }
    return (allProperties || []).filter((p) => p.property_status !== 'DELETED');
  }, [activeMember, allProperties]);

  // Selected Property for Slide-over Details Panel
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<PropertyRecord | null>(null);

  // Filter tab: All | Land | Commercial | Private House
  const [activeTab, setActiveTab] = useState<RealEstateCategoryTab>('All');

  // Search query
  const [search, setSearch] = useState('');

  // Sort order: due_date | due_amount_desc | newest | price_desc | price_asc | name
  const [sort, setSort] = useState<'due_date' | 'due_amount_desc' | 'newest' | 'price_desc' | 'price_asc' | 'name'>('due_date');

  // View mode: Cards vs List
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Filter Popover state: Status, Location, Purchase Price
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<RealEstateFilterState>({
    status: 'all',
    location: 'all',
    priceRange: 'all'
  });

  const handleResetFilters = () => {
    setFilters({
      status: 'all',
      location: 'all',
      priceRange: 'all'
    });
    setActiveTab('All');
    setSearch('');
  };

  // Distinct locations for filter popover
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    properties.forEach((p) => {
      if (p.location && p.location.trim()) {
        locSet.add(p.location.trim());
      }
    });
    return Array.from(locSet).sort();
  }, [properties]);

  // 1. Three compact summary metrics: Total Purchase Value, Active Properties, Rental Income
  const activeProperties = useMemo(() => {
    return properties.filter((p) => (p.property_status || 'ACTIVE') === 'ACTIVE');
  }, [properties]);

  const totalActivePurchaseValue = useMemo(() => {
    return activeProperties.reduce((sum, p) => sum + (Number(p.purchase_price) || 0), 0);
  }, [activeProperties]);

  // Total Monthly Rental Income across currently active leases
  const totalMonthlyRentalIncome = useMemo(() => {
    return rents
      .filter((r) => r.is_active)
      .reduce((sum, r) => sum + (Number(r.rent_amount) || 0), 0);
  }, [rents]);

  const activeRentsCount = useMemo(() => {
    return rents.filter((r) => r.is_active).length;
  }, [rents]);

  // Filtering & Sorting
  const filteredProperties = useMemo(() => {
    let list = [...properties];

    // Category tab filter
    if (activeTab !== 'All') {
      list = list.filter((p) => getRealEstateCategory(p) === activeTab);
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          (p.party_name && p.party_name.toLowerCase().includes(q)) ||
          (p.p_notes && p.p_notes.toLowerCase().includes(q))
      );
    }

    // Popover: Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        list = list.filter((p) => (p.property_status || 'ACTIVE') === 'ACTIVE');
      } else if (filters.status === 'sold') {
        list = list.filter((p) => p.property_status === 'SOLD');
      }
    }

    // Popover: Location filter
    if (filters.location !== 'all') {
      list = list.filter((p) => p.location.toLowerCase() === filters.location.toLowerCase());
    }

    // Popover: Purchase Price Range filter
    if (filters.priceRange !== 'all') {
      list = list.filter((p) => {
        const pr = Number(p.purchase_price) || 0;
        if (filters.priceRange === 'under_25l') return pr > 0 && pr < 2500000;
        if (filters.priceRange === '25l_50l') return pr >= 2500000 && pr <= 5000000;
        if (filters.priceRange === '50l_1cr') return pr > 5000000 && pr <= 10000000;
        if (filters.priceRange === 'above_1cr') return pr > 10000000;
        return true;
      });
    }

    // Sort properties based on selected sort option
    const getPropertyClosestDueDate = (p: PropertyRecord): string | null => {
      const fin = calculatePropertyFinances(p.p_id);
      const rent = getActiveRentForProperty(p.p_id);
      const dates: string[] = [];
      if (fin.nextDueDate) dates.push(fin.nextDueDate);
      if (rent?.next_rent_due) dates.push(rent.next_rent_due);
      if (dates.length === 0) return null;
      dates.sort();
      return dates[0];
    };

    const isFullyPaid = (p: PropertyRecord): boolean => {
      const pr = Number(p.purchase_price) || 0;
      if (p.property_status === 'SOLD') return false;
      const fin = calculatePropertyFinances(p.p_id);
      return pr > 0 && fin.paymentLeft <= 0;
    };

    if (sort === 'due_date') {
      list.sort((a, b) => {
        const fullyPaidA = isFullyPaid(a);
        const fullyPaidB = isFullyPaid(b);

        // 1. All fully paid properties must be at last in the list
        if (!fullyPaidA && fullyPaidB) return -1;
        if (fullyPaidA && !fullyPaidB) return 1;

        if (!fullyPaidA && !fullyPaidB) {
          // Both have pending payments: sort by nearest upcoming/overdue due date
          const dueA = getPropertyClosestDueDate(a);
          const dueB = getPropertyClosestDueDate(b);
          if (dueA && dueB) return dueA.localeCompare(dueB);
          if (dueA && !dueB) return -1;
          if (!dueA && dueB) return 1;
          return (b.purchase_date || '').localeCompare(a.purchase_date || '');
        }

        // Both are fully paid: sort by nearest active rent due date or newest purchase
        const dueA = getPropertyClosestDueDate(a);
        const dueB = getPropertyClosestDueDate(b);
        if (dueA && dueB) return dueA.localeCompare(dueB);
        return (b.purchase_date || '').localeCompare(a.purchase_date || '');
      });
    } else if (sort === 'due_amount_desc') {
      // 2. Sort based on highest due amount left
      list.sort((a, b) => {
        const finA = calculatePropertyFinances(a.p_id);
        const finB = calculatePropertyFinances(b.p_id);
        const dueA = finA.paymentLeft || 0;
        const dueB = finB.paymentLeft || 0;

        if (dueB !== dueA) {
          return dueB - dueA; // highest due amount left first
        }
        return (b.purchase_date || '').localeCompare(a.purchase_date || '');
      });
    } else if (sort === 'newest') {
      list.sort((a, b) => (b.purchase_date || '').localeCompare(a.purchase_date || ''));
    } else if (sort === 'price_desc') {
      list.sort((a, b) => (Number(b.purchase_price) || 0) - (Number(a.purchase_price) || 0));
    } else if (sort === 'price_asc') {
      list.sort((a, b) => (Number(a.purchase_price) || 0) - (Number(b.purchase_price) || 0));
    } else if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [properties, activeTab, search, filters, sort, calculatePropertyFinances, getActiveRentForProperty, midnightTicker, now]);

  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return properties.find((p) => p.p_id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    activeTab !== 'All' ||
    filters.status !== 'all' ||
    filters.location !== 'all' ||
    filters.priceRange !== 'all';

  const toastHandler = onShowToast || ((_msg, _type) => {});

  const handleOpenAddModal = () => {
    setPropertyToEdit(null);
    setIsAddModalOpen(true);
  };

  const handleEditFromPanel = (p: PropertyRecord) => {
    setSelectedPropertyId(null);
    setPropertyToEdit(p);
    setIsAddModalOpen(true);
  };

  return (
    <div className="main-content fade-in" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* 1. Header: “Real Estate” + “Add Property” */}
      <div className="bullion-executive-header">
        <div>
          <div className="bullion-breadcrumb-text">
            <span onClick={() => navigate('/home')} className="bullion-breadcrumb-link">
              Portfolio
            </span>
            <span>/</span>
            <span>Real Estate</span>
          </div>
          <h1 className="bullion-page-title">Real Estate</h1>
          <p className="bullion-page-subtitle">
            Property holdings &amp; rental portfolio for {activeMember?.name || 'User'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary bullion-primary-add-btn"
          onClick={handleOpenAddModal}
        >
          <Plus size={16} />
          <span>Add Property</span>
        </button>
      </div>

      {/* 2. Three compact summary cards: Total Purchase Value, Active Properties, Rental Income */}
      <div className="bullion-overview-grid">
        {/* Card 1: Total Purchase Value */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">Total Purchase Value</span>
          <div className="bullion-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalActivePurchaseValue)}
          </div>
          <div className="bullion-overview-sub">
            Across {activeProperties.length} active holdings
          </div>
        </div>

        {/* Card 2: Active Properties */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">Active Properties</span>
          <div className="bullion-overview-value">
            {activeProperties.length}
            <span className="bullion-overview-unit">Properties</span>
          </div>
          <div className="bullion-overview-sub">
            Land, commercial &amp; residential
          </div>
        </div>

        {/* Card 3: Rental Income (Kept strictly separate from purchase value) */}
        <div className="bullion-overview-card">
          <span className="bullion-overview-kicker">Rental Income</span>
          <div className="bullion-overview-value">
            <span style={{ color: 'var(--color-gold)', marginRight: '4px', fontWeight: 700 }}>₹</span>
            {formatCurrency(totalMonthlyRentalIncome)}
            <span className="bullion-overview-unit" style={{ fontSize: '12px' }}>/mo</span>
          </div>
          <div className="bullion-overview-sub">
            From {activeRentsCount} active tenant {activeRentsCount === 1 ? 'lease' : 'leases'}
          </div>
        </div>
      </div>

      {/* 3. Simple filter tabs: All | Land | Commercial | Private House */}
      <div className="bullion-category-tabs-bar">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`bullion-category-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <span>{tab}</span>
          </button>
        ))}
      </div>

      {/* 4. Controls Bar: Search + Compact Filter (Status, Location, Price) + View Switcher */}
      <div className="bullion-toolbar-container">
        {/* Search */}
        <div className="bullion-search-wrapper">
          <Search size={16} className="bullion-search-icon" />
          <input
            type="text"
            className="bullion-search-input"
            placeholder="Search by name, location, party..."
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

          {/* Sort By Dropdown (Features 1 & 2) */}
          <select
            className="re-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            aria-label="Sort properties"
          >
            <option value="due_date">Sort: Upcoming Due Date</option>
            <option value="due_amount_desc">Sort: Highest Due Left</option>
            <option value="newest">Sort: Newest Purchase</option>
            <option value="price_desc">Sort: Price: High to Low</option>
            <option value="price_asc">Sort: Price: Low to High</option>
            <option value="name">Sort: Name (A to Z)</option>
          </select>

          {/* Compact filter control for Status, Location, and Purchase Price */}
          <RealEstateFilterPopover
            isOpen={isFilterOpen}
            onToggle={() => setIsFilterOpen(!isFilterOpen)}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            availableLocations={availableLocations}
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

      {/* 4b. Compact Deadline Colour Map Reference Strip (Feature 3 - Occupies minimal space) */}
      <div className="re-color-map-strip">
        <span className="re-color-map-title">
          <Clock size={11} />
          <span>Deadline Colour Map:</span>
        </span>
        <span className="re-color-map-pill overdue" title="Payment deadline has passed">
          <span className="re-color-map-dot" />
          <span>Overdue</span>
        </span>
        <span className="re-color-map-pill urgent" title="Payment due within 15 days">
          <span className="re-color-map-dot" />
          <span>&lt; 15 Days</span>
        </span>
        <span className="re-color-map-pill medium" title="Payment due in 15 to 45 days">
          <span className="re-color-map-dot" />
          <span>15 – 45 Days</span>
        </span>
        <span className="re-color-map-pill upcoming" title="Payment due in more than 45 days">
          <span className="re-color-map-dot" />
          <span>&gt; 45 Days</span>
        </span>
        <span
          className="re-color-map-pill no-due"
          title="Initial payment paid (less than purchase price) but due date not specified"
        >
          <span className="re-color-map-dot" />
          <span>No Due Date</span>
        </span>
        <span className="re-color-map-pill completed" title="100% Fully Paid">
          <span className="re-color-map-dot" />
          <span>Fully Paid</span>
        </span>
      </div>

      {/* 5. Main Area: Clean Cards Grid or Empty State */}
      {filteredProperties.length === 0 ? (
        <div className="bullion-empty-container">
          <div className="bullion-empty-icon-circle">
            <Building size={28} color="#0F172A" />
          </div>
          <h3 className="bullion-empty-title">
            {hasActiveFilters ? 'No Matching Properties' : 'No properties yet'}
          </h3>
          <p className="bullion-empty-subtitle">
            {hasActiveFilters
              ? 'No property records matched your active filter criteria. Try resetting filters.'
              : 'Add land, commercial spaces, or houses to track values and rental income.'}
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
              <span>Add Property</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="bullion-grid-layout">
          {filteredProperties.map((p) => (
            <RealEstateCard
              key={p.p_id}
              property={p}
              activeRent={getActiveRentForProperty(p.p_id)}
              finances={calculatePropertyFinances(p.p_id)}
              isSelected={selectedPropertyId === p.p_id}
              onClick={() => setSelectedPropertyId(p.p_id)}
            />
          ))}
        </div>
      ) : (
        <div className="bullion-list-layout">
          {filteredProperties.map((p) => (
            <RealEstateCard
              key={p.p_id}
              property={p}
              activeRent={getActiveRentForProperty(p.p_id)}
              finances={calculatePropertyFinances(p.p_id)}
              isSelected={selectedPropertyId === p.p_id}
              onClick={() => setSelectedPropertyId(p.p_id)}
            />
          ))}
        </div>
      )}

      {/* 6. Slide-over Details Panel (Opens when card is clicked) */}
      {selectedProperty && (
        <div className="bullion-drawer-backdrop fade-in" onClick={() => setSelectedPropertyId(null)}>
          <div
            className="bullion-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <RealEstateDetailsPanel
              property={selectedProperty}
              activeRent={getActiveRentForProperty(selectedProperty.p_id)}
              onClose={() => setSelectedPropertyId(null)}
              onEdit={handleEditFromPanel}
              onShowToast={toastHandler}
              isDrawer={true}
            />
          </div>
        </div>
      )}

      {/* 7. Add / Edit Property Modal */}
      <AddPropertyModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setPropertyToEdit(null);
        }}
        propertyToEdit={propertyToEdit}
        onShowToast={toastHandler}
        onSaved={(saved) => {
          setSelectedPropertyId(saved.p_id);
        }}
      />
    </div>
  );
};
