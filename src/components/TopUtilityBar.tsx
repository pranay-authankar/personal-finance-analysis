import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { GlobalHeaderClock } from './GlobalHeaderClock';
import { Menu, ChevronRight, Lock } from 'lucide-react';

interface TopUtilityBarProps {
  onOpenMobileMenu: () => void;
}

export const TopUtilityBar: React.FC<TopUtilityBarProps> = ({ onOpenMobileMenu }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeMember, isAuthenticated, logout } = useInvestments();

  if (!isAuthenticated) return null;

  // Determine current page title / breadcrumb
  const getPageInfo = () => {
    const p = location.pathname;
    if (p === '/home') return { title: 'Dashboard', sub: 'Portfolio Overview' };
    if (p.startsWith('/fds') || p === '/add-fd') return { title: 'Fixed Deposits', sub: 'FD Management' };
    if (p.startsWith('/post-office') || p === '/add-post-office') return { title: 'Post Office', sub: 'National Savings' };
    if (p.startsWith('/bullions') || p === '/add-bullion') return { title: 'Bullions', sub: 'Gold & Silver' };
    if (p.startsWith('/real-estate') || p === '/add-property') return { title: 'Real Estate', sub: 'Properties & Rentals' };
    if (p.startsWith('/realized-funds') || p === '/add-realized-fund') return { title: 'Realized Funds', sub: 'Capital Receipts' };
    if (p === '/family-select') return { title: 'Family Members', sub: 'Switch Vault Profile' };
    return { title: 'FamilyVault', sub: 'Investment Tracker' };
  };

  const { title, sub } = getPageInfo();

  return (
    <header className="app-top-utility-bar">
      <div className="top-utility-container">
        {/* Left Side: Mobile Menu Button & Breadcrumb Context */}
        <div className="top-utility-left">
          <button
            type="button"
            className="top-utility-mobile-btn"
            onClick={onOpenMobileMenu}
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <Menu size={20} strokeWidth={2.2} />
          </button>

          <div className="top-utility-breadcrumb">
            <span className="breadcrumb-kicker">Portfolio</span>
            <ChevronRight size={13} className="breadcrumb-sep" />
            <span className="breadcrumb-current-title">{title}</span>
            <span className="breadcrumb-sub-badge">{sub}</span>
          </div>
        </div>

        {/* Right Side: Global Date & Time System + Member Context */}
        <div className="top-utility-right">
          {/* Global Live Clock & Calendar Popover */}
          <div className="top-utility-clock-wrapper">
            <GlobalHeaderClock />
          </div>

          {/* Manual Vault Lock Button */}
          <button
            type="button"
            className="top-utility-lock-btn"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            title="Lock Encrypted Vault"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <Lock size={13} strokeWidth={2.2} />
            <span>Lock</span>
          </button>

          {/* Quick Active Member Chip */}
          <button
            type="button"
            className="top-utility-member-chip"
            onClick={() => navigate('/family-select')}
            title="Switch family member context"
          >
            <span className="member-chip-avatar">
              {activeMember?.avatar || '👤'}
            </span>
            <span className="member-chip-name">
              {activeMember?.name || 'Member'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
