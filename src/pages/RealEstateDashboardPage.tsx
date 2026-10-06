import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import type { ViewMode, PropertyRecord } from '../types';
import { formatCurrency } from '../utils/calculations';
import { RealEstateCard } from '../components/RealEstateCard';
import { RealEstateTable } from '../components/RealEstateTable';
import { RealEstateDonutChart } from '../components/RealEstateDonutChart';
import {
  PROPERTY_TYPE_CONFIG,
  RENTED_CATEGORY_CONFIG,
  SOLD_CATEGORY_CONFIG
} from '../utils/deadlinesColorMap';
import {
  Plus,
  Search,
  X,
  LayoutGrid,
  Table as TableIcon,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

export const RealEstateDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeMember,
    properties: allProperties,
    rents,
    calculatePropertyFinances,
    getActiveRentForProperty
  } = useInvestments();

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<string>('amount-desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'missed'>('all');

  // Determine current active properties list based on active member or all vault properties
  const properties = useMemo(() => {
    if (activeMember?.id && activeMember.properties && activeMember.properties.length > 0) {
      return activeMember.properties;
    }
    return allProperties;
  }, [activeMember, allProperties]);

  // Active properties (exclude SOLD and DELETED)
  const activeProperties = useMemo(() => {
    return properties.filter((p) => (p.property_status || 'ACTIVE') === 'ACTIVE');
  }, [properties]);

  // Sold properties (history)
  const soldProperties = useMemo(() => {
    return properties.filter((p) => p.property_status === 'SOLD');
  }, [properties]);

  // Active Rented properties
  const rentedProperties = useMemo(() => {
    const activeRentedIds = new Set(
      rents.filter((r) => r.is_active).map((r) => r.p_id)
    );
    return activeProperties.filter((p) => activeRentedIds.has(p.p_id));
  }, [activeProperties, rents]);

  // Total Active Investment Value
  const totalActiveInvestmentValue = useMemo(() => {
    return activeProperties.reduce((sum, p) => sum + (Number(p.purchase_price) || 0), 0);
  }, [activeProperties]);

  // Total Monthly Rental Income
  const totalMonthlyRentalIncome = useMemo(() => {
    return rents
      .filter((r) => r.is_active)
      .reduce((sum, r) => sum + (Number(r.rent_amount) || 0), 0);
  }, [rents]);

  // Payment status counts (auto-detected)
  const paymentStats = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let missed = 0;
    activeProperties.forEach((p) => {
      const f = calculatePropertyFinances(p.p_id);
      if (f.paymentStatus === 'completed') completed++;
      else if (f.paymentStatus === 'missed') missed++;
      else pending++;
    });
    return { completed, pending, missed };
  }, [activeProperties, calculatePropertyFinances]);

  // Category counts
  const counts = useMemo(() => {
    let land = 0, commercial = 0, privateProperties = 0;
    activeProperties.forEach((p) => {
      if (p.p_type === 'LAND' || p.p_type === 'Land') land++;
      else if (p.p_type === 'COMMERCIAL_PROPERTY' || p.p_type === 'Commercial Property') commercial++;
      else privateProperties++;
    });
    return {
      all: activeProperties.length,
      land,
      commercial,
      privateProperties,
      privateHouse: privateProperties,
      rented: rentedProperties.length,
      sold: soldProperties.length
    };
  }, [activeProperties, rentedProperties, soldProperties]);

  // Filtering & Sorting
  const filteredProperties = useMemo(() => {
    let list: PropertyRecord[] = [];

    if (selectedCategory === 'sold') {
      list = [...soldProperties];
    } else if (selectedCategory === 'rented') {
      list = [...rentedProperties];
    } else if (selectedCategory === 'land') {
      list = activeProperties.filter((p) => p.p_type === 'LAND' || p.p_type === 'Land');
    } else if (selectedCategory === 'commercial') {
      list = activeProperties.filter((p) => p.p_type === 'COMMERCIAL_PROPERTY' || p.p_type === 'Commercial Property');
    } else if (selectedCategory === 'private-house') {
      list = activeProperties.filter(
        (p) =>
          p.p_type === 'PRIVATE_PROPERTIES' ||
          p.p_type === 'Private Properties' ||
          p.p_type === 'PRIVATE_HOUSE' ||
          p.p_type === 'Private House'
      );
    } else {
      list = [...activeProperties];
    }

    // Payment status filter
    if (statusFilter !== 'all' && selectedCategory !== 'sold') {
      list = list.filter((p) => {
        const f = calculatePropertyFinances(p.p_id);
        return f.paymentStatus === statusFilter;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => {
        const activeRent = getActiveRentForProperty(p.p_id);
        return (
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.party_name.toLowerCase().includes(q) ||
          (p.p_notes && p.p_notes.toLowerCase().includes(q)) ||
          (activeRent && activeRent.tenant_name.toLowerCase().includes(q))
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'amount-desc') return (b.purchase_price || 0) - (a.purchase_price || 0);
      if (sort === 'amount-asc') return (a.purchase_price || 0) - (b.purchase_price || 0);
      if (sort === 'date-desc') return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
      if (sort === 'date-asc') return new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime();
      if (sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [
    selectedCategory,
    statusFilter,
    activeProperties,
    soldProperties,
    rentedProperties,
    search,
    sort,
    getActiveRentForProperty,
    calculatePropertyFinances
  ]);

  return (
    <div className="page-container fade-in" style={{ paddingBottom: '60px' }}>
      {/* 1. Header Bar: Minimal, Direct */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Real Estate
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            {activeProperties.length} active assets • {rentedProperties.length} rented • {soldProperties.length} sold
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/add-property')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontWeight: 700 }}
        >
          <Plus size={16} />
          <span>Add Property</span>
        </button>
      </div>

      {/* 2. Visual KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        {/* Total Capital */}
        <div className="card-panel" style={{ padding: '18px 20px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Portfolio Valuation
            </span>
            <span style={{ fontSize: '18px' }}>💎</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#7C3AED', marginTop: '6px' }}>
            ₹ {formatCurrency(totalActiveInvestmentValue)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span>{counts.land} Land</span> • 
            <span>{counts.commercial} Commercial</span> • 
            <span>{counts.privateProperties} Private Properties</span>
          </div>
        </div>

        {/* Monthly Rent */}
        <div className="card-panel" style={{ padding: '18px 20px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Rental Income
            </span>
            <span style={{ fontSize: '18px' }}>🔑</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '6px' }}>
            ₹ {formatCurrency(totalMonthlyRentalIncome)}
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>/mo</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            From {rentedProperties.length} active lease{rentedProperties.length === 1 ? '' : 's'} (bank account inflow)
          </div>
        </div>

        {/* Automatic Payment Status Overview */}
        <div className="card-panel" style={{ padding: '18px 20px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Payment Status
            </span>
            <span style={{ fontSize: '18px' }}>📊</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {/* Completed */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: statusFilter === 'completed' ? '#15803D' : '#DCFCE7',
                color: statusFilter === 'completed' ? '#FFFFFF' : '#15803D',
                border: '1px solid #86EFAC',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <CheckCircle2 size={12} />
              <span>{paymentStats.completed} Completed</span>
            </button>

            {/* Pending */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: statusFilter === 'pending' ? '#1E40AF' : '#EFF6FF',
                color: statusFilter === 'pending' ? '#FFFFFF' : '#1E40AF',
                border: '1px solid #BFDBFE',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Clock size={12} />
              <span>{paymentStats.pending} Pending</span>
            </button>

            {/* Missed */}
            {paymentStats.missed > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'missed' ? 'all' : 'missed')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: statusFilter === 'missed' ? '#991B1B' : '#FEE2E2',
                  color: statusFilter === 'missed' ? '#FFFFFF' : '#991B1B',
                  border: '1px solid #FCA5A5',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <AlertCircle size={12} />
                <span>{paymentStats.missed} Missed</span>
              </button>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {statusFilter !== 'all' ? `Filtered by ${statusFilter} payments (click pill to reset)` : 'Detected automatically by initial payment & deadline'}
          </div>
        </div>
      </div>

      {/* 3. Donut Distribution Card */}
      <div className="card-panel" style={{ padding: '20px 22px', marginBottom: '22px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Asset Distribution
          </h2>
          {selectedCategory !== 'all' && (
            <button
              className="btn btn-subtle btn-sm"
              onClick={() => setSelectedCategory('all')}
              style={{ fontSize: '11px', color: 'var(--color-primary)' }}
            >
              Reset Filter
            </button>
          )}
        </div>

        <RealEstateDonutChart
          properties={properties}
          rents={rents}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
        />
      </div>

      {/* 4. Category Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--border-light)'
        }}
      >
        <button
          className={`tab-btn ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            border: selectedCategory === 'all' ? '1px solid var(--color-primary)' : '1px solid var(--border-light)',
            background: selectedCategory === 'all' ? 'var(--color-primary)' : 'var(--bg-surface)',
            color: selectedCategory === 'all' ? '#FFFFFF' : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>All</span>
          <span style={{ opacity: 0.8, fontSize: '10px' }}>({counts.all})</span>
        </button>

        <button
          className={`tab-btn ${selectedCategory === 'land' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('land')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            border: selectedCategory === 'land' ? `1px solid ${PROPERTY_TYPE_CONFIG['Land'].color}` : '1px solid var(--border-light)',
            background: selectedCategory === 'land' ? PROPERTY_TYPE_CONFIG['Land'].bgColor : 'var(--bg-surface)',
            color: selectedCategory === 'land' ? PROPERTY_TYPE_CONFIG['Land'].color : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>{PROPERTY_TYPE_CONFIG['Land'].icon} Land</span>
          <span style={{ opacity: 0.8, fontSize: '10px' }}>({counts.land})</span>
        </button>

        <button
          className={`tab-btn ${selectedCategory === 'commercial' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('commercial')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            border: selectedCategory === 'commercial' ? `1px solid ${PROPERTY_TYPE_CONFIG['Commercial Property'].color}` : '1px solid var(--border-light)',
            background: selectedCategory === 'commercial' ? PROPERTY_TYPE_CONFIG['Commercial Property'].bgColor : 'var(--bg-surface)',
            color: selectedCategory === 'commercial' ? PROPERTY_TYPE_CONFIG['Commercial Property'].color : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>{PROPERTY_TYPE_CONFIG['Commercial Property'].icon} Commercial</span>
          <span style={{ opacity: 0.8, fontSize: '10px' }}>({counts.commercial})</span>
        </button>

        <button
          className={`tab-btn ${selectedCategory === 'private-house' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('private-house')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            border: selectedCategory === 'private-house' ? `1px solid ${PROPERTY_TYPE_CONFIG['Private Properties'].color}` : '1px solid var(--border-light)',
            background: selectedCategory === 'private-house' ? PROPERTY_TYPE_CONFIG['Private Properties'].bgColor : 'var(--bg-surface)',
            color: selectedCategory === 'private-house' ? PROPERTY_TYPE_CONFIG['Private Properties'].color : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>{PROPERTY_TYPE_CONFIG['Private Properties'].icon} Private Properties</span>
          <span style={{ opacity: 0.8, fontSize: '10px' }}>({counts.privateProperties})</span>
        </button>

        <button
          className={`tab-btn ${selectedCategory === 'rented' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('rented')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            border: selectedCategory === 'rented' ? `1px solid ${RENTED_CATEGORY_CONFIG.color}` : '1px solid var(--border-light)',
            background: selectedCategory === 'rented' ? RENTED_CATEGORY_CONFIG.bgColor : 'var(--bg-surface)',
            color: selectedCategory === 'rented' ? RENTED_CATEGORY_CONFIG.color : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>{RENTED_CATEGORY_CONFIG.icon} Rented</span>
          <span style={{ opacity: 0.8, fontSize: '10px' }}>({counts.rented})</span>
        </button>

        <button
          className={`tab-btn ${selectedCategory === 'sold' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('sold')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            border: selectedCategory === 'sold' ? `1px solid ${SOLD_CATEGORY_CONFIG.color}` : '1px solid var(--border-light)',
            background: selectedCategory === 'sold' ? SOLD_CATEGORY_CONFIG.bgColor : 'var(--bg-surface)',
            color: selectedCategory === 'sold' ? SOLD_CATEGORY_CONFIG.color : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>{SOLD_CATEGORY_CONFIG.icon} Sold</span>
          <span style={{ opacity: 0.8, fontSize: '10px' }}>({counts.sold})</span>
        </button>
      </div>

      {/* Rented Category Summary Banner */}
      {selectedCategory === 'rented' && (
        <div
          style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '1px solid #FDE68A',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#D97706',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
              }}
            >
              🔑
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#92400E' }}>
                  Rented Properties
                </h3>
                <span
                  style={{
                    background: '#FDE68A',
                    color: '#92400E',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  {rentedProperties.length} Active {rentedProperties.length === 1 ? 'Lease' : 'Leases'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#B45309' }}>
                Tracking monthly rent generation and tenant lease schedules
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#92400E', letterSpacing: '0.04em' }}>
              Total Monthly Rental Income
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#B45309', marginTop: '2px' }}>
              ₹ {formatCurrency(totalMonthlyRentalIncome)}
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400E' }}> / month</span>
            </div>
            <div style={{ fontSize: '11px', color: '#B45309', marginTop: '2px' }}>
              Annualized: ₹ {formatCurrency(totalMonthlyRentalIncome * 12)} / year
            </div>
          </div>
        </div>
      )}

      {/* 5. Compact Filter & Search Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', paddingRight: search ? '30px' : '10px', height: '36px', fontSize: '12px' }}
            placeholder="Search properties, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="form-input"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ height: '36px', fontSize: '12px', width: 'auto' }}
          >
            <option value="amount-desc">Price: High to Low</option>
            <option value="amount-asc">Price: Low to High</option>
            <option value="date-desc">Newest First</option>
            <option value="name">Name (A-Z)</option>
          </select>

          <div style={{ display: 'flex', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button
              className={`btn btn-subtle btn-sm ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              style={{
                borderRadius: 0,
                padding: '6px 10px',
                background: viewMode === 'cards' ? 'var(--color-primary)' : 'var(--bg-surface)',
                color: viewMode === 'cards' ? '#FFFFFF' : 'var(--text-muted)'
              }}
              title="Cards View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={`btn btn-subtle btn-sm ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              style={{
                borderRadius: 0,
                padding: '6px 10px',
                background: viewMode === 'table' ? 'var(--color-primary)' : 'var(--bg-surface)',
                color: viewMode === 'table' ? '#FFFFFF' : 'var(--text-muted)'
              }}
              title="Table View"
            >
              <TableIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Properties Listing */}
      {filteredProperties.length === 0 ? (
        <div
          className="card-panel"
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            border: '1px dashed var(--border-medium)',
            background: 'var(--bg-surface)'
          }}
        >
          <Building size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            No properties found
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
            {search || statusFilter !== 'all'
              ? 'No property matched your filters.'
              : 'Add your property to track payments and returns.'}
          </p>
          {selectedCategory !== 'all' || statusFilter !== 'all' ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedCategory('all');
                setStatusFilter('all');
                setSearch('');
              }}
            >
              Clear Filters
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/add-property')}>
              <Plus size={14} />
              <span>Add Property</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px' }}>
          {filteredProperties.map((prop) => {
            const activeRent = getActiveRentForProperty(prop.p_id);
            const finances = calculatePropertyFinances(prop.p_id);
            return (
              <RealEstateCard
                key={prop.p_id}
                property={prop}
                activeRent={activeRent}
                finances={finances}
                isRentedView={selectedCategory === 'rented'}
              />
            );
          })}
        </div>
      ) : (
        <RealEstateTable
          items={filteredProperties.map((prop) => ({
            property: prop,
            activeRent: getActiveRentForProperty(prop.p_id),
            finances: calculatePropertyFinances(prop.p_id)
          }))}
          displayMode={
            selectedCategory === 'rented'
              ? 'rented'
              : selectedCategory === 'sold'
              ? 'sold'
              : 'all'
          }
        />
      )}
    </div>
  );
};
