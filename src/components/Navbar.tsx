import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { GlobalHeaderClock } from './GlobalHeaderClock';
import { Layers, PieChart, Landmark, Mail, Coins, Building, Wallet, Trash2, LogOut, ChevronDown } from 'lucide-react';

interface NavbarProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeMember, logout, clearAllData, isAuthenticated } = useInvestments();

  if (!isAuthenticated) return null;

  const isHome = location.pathname === '/home';
  const isFds = location.pathname.startsWith('/fds');
  const isPostOffice = location.pathname.startsWith('/post-office');
  const isBullions = location.pathname.startsWith('/bullions');
  const isRealEstate = location.pathname.startsWith('/real-estate') || location.pathname.startsWith('/add-property');
  const isRealized = location.pathname.startsWith('/realized-funds');

  const fdCount = activeMember?.fds?.length || 0;
  const poCount = activeMember?.postOfficeInvestments?.length || 0;
  const bulCount = activeMember?.bullionsInvestments?.length || 0;
  const realEstateCount = (activeMember?.properties || []).filter(
    (p) => p.property_status === 'ACTIVE'
  ).length;
  const realizedCount = activeMember?.realizedFunds?.length || 0;

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      '⚠️ PERMANENT ACTION: Clear all application data?\n\nThis will permanently remove all stored records from all 11 CSV files while preserving file headers. Application state will be reset to a clean zero-data state.\n\nAre you sure you want to proceed?'
    );
    if (confirmed) {
      await clearAllData();
      onShowToast('All application data cleared permanently (zero-data state).', 'warn');
      navigate('/family-select');
    }
  };

  const handleLogout = () => {
    logout();
    onShowToast('Signed out of family vault.', 'info');
    navigate('/login');
  };

  return (
    <header className="app-navbar">
      <div className="nav-container">
        {/* Brand Lockup */}
        <div className="nav-brand" onClick={() => navigate('/home')} role="button" tabIndex={0}>
          <div className="brand-icon">
            <Layers size={22} strokeWidth={2.5} />
          </div>
          <div className="brand-text">
            <span className="brand-title">FamilyVault</span>
            <span className="brand-version">Portfolio V1</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-links">
          <button
            className={`nav-tab ${isHome ? 'active' : ''}`}
            onClick={() => navigate('/home')}
          >
            <PieChart size={18} strokeWidth={2} />
            <span>Portfolio</span>
          </button>

          <button
            className={`nav-tab ${isFds ? 'active' : ''}`}
            onClick={() => navigate('/fds')}
          >
            <Landmark size={18} strokeWidth={2} />
            <span>Fixed Deposits</span>
            <span className="nav-pill-badge">{fdCount}</span>
          </button>

          <button
            className={`nav-tab ${isPostOffice ? 'active' : ''}`}
            onClick={() => navigate('/post-office')}
          >
            <Mail size={18} strokeWidth={2} />
            <span>Post Office</span>
            <span className="nav-pill-badge" style={{ background: '#EA580C' }}>{poCount}</span>
          </button>

          <button
            className={`nav-tab ${isBullions ? 'active' : ''}`}
            onClick={() => navigate('/bullions')}
          >
            <Coins size={18} strokeWidth={2} />
            <span>Bullions</span>
            <span className="nav-pill-badge" style={{ background: '#D97706' }}>{bulCount}</span>
          </button>

          <button
            className={`nav-tab ${isRealEstate ? 'active' : ''}`}
            onClick={() => navigate('/real-estate')}
          >
            <Building size={18} strokeWidth={2} />
            <span>Real Estate</span>
            <span className="nav-pill-badge" style={{ background: '#7C3AED' }}>{realEstateCount}</span>
          </button>

          <button
            className={`nav-tab ${isRealized ? 'active' : ''}`}
            onClick={() => navigate('/realized-funds')}
          >
            <Wallet size={18} strokeWidth={2} />
            <span>Realized Funds</span>
            <span className="nav-pill-badge" style={{ background: '#0F1E36' }}>{realizedCount}</span>
          </button>
        </nav>

        {/* Right Side: Global Clock, Active Member Switcher & Utilities */}
        <div className="nav-user-actions">
          <GlobalHeaderClock />

          <button
            className="member-selector-btn"
            onClick={() => navigate('/family-select')}
            title="Switch family member"
          >
            <span className="member-avatar-chip">{activeMember?.avatar || '👨'}</span>
            <div className="member-info-col">
              <span className="member-role-label">{activeMember?.role || 'Member'}</span>
              <strong className="member-name-label">{activeMember?.name || 'User'}</strong>
            </div>
            <ChevronDown size={16} strokeWidth={2.5} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button
            className="btn btn-subtle btn-sm"
            style={{ color: '#DC2626' }}
            onClick={handleClearAll}
            title="Permanently remove all records across all 11 CSV files (Zero-Data State)"
          >
            <Trash2 size={15} />
            <span>Clear All Data</span>
          </button>

          <button
            className="btn btn-subtle btn-sm"
            onClick={handleLogout}
            title="Sign out of FamilyVault"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
