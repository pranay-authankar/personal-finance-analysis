import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import {
  Layers,
  LayoutDashboard,
  Landmark,
  Mail,
  Coins,
  Building,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  Trash2,
  LogOut,
  X,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onShowToast
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeMember, logout, clearAllData, isAuthenticated } = useInvestments();
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettingsPopover(false);
      }
    };
    if (showSettingsPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsPopover]);

  if (!isAuthenticated) return null;

  // Active state matching
  const isDashboard = location.pathname === '/home';
  const isFds = location.pathname.startsWith('/fds') || location.pathname === '/add-fd';
  const isPostOffice = location.pathname.startsWith('/post-office') || location.pathname === '/add-post-office';
  const isBullions = location.pathname.startsWith('/bullions') || location.pathname === '/add-bullion';
  const isRealEstate = location.pathname.startsWith('/real-estate') || location.pathname.startsWith('/add-property');
  const isRealized = location.pathname.startsWith('/realized-funds') || location.pathname === '/add-realized-fund';

  // Counts for badges
  const fdCount = activeMember?.fds?.length || 0;
  const poCount = activeMember?.postOfficeInvestments?.length || 0;
  const bulCount = activeMember?.bullionsInvestments?.length || 0;
  const realEstateCount = (activeMember?.properties || []).filter(
    (p) => p.property_status === 'ACTIVE'
  ).length;
  const realizedCount = activeMember?.realizedFunds?.length || 0;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/home',
      active: isDashboard,
      count: undefined,
      badgeColor: undefined
    },
    {
      id: 'fds',
      label: 'Fixed Deposits',
      icon: Landmark,
      path: '/fds',
      active: isFds,
      count: fdCount,
      badgeColor: 'var(--color-navy)'
    },
    {
      id: 'post-office',
      label: 'Post Office',
      icon: Mail,
      path: '/post-office',
      active: isPostOffice,
      count: poCount,
      badgeColor: '#EA580C'
    },
    {
      id: 'bullions',
      label: 'Bullions',
      icon: Coins,
      path: '/bullions',
      active: isBullions,
      count: bulCount,
      badgeColor: '#D97706'
    },
    {
      id: 'real-estate',
      label: 'Real Estate',
      icon: Building,
      path: '/real-estate',
      active: isRealEstate,
      count: realEstateCount,
      badgeColor: '#7C3AED'
    },
    {
      id: 'realized-funds',
      label: 'Realized Funds',
      icon: Wallet,
      path: '/realized-funds',
      active: isRealized,
      count: realizedCount,
      badgeColor: '#0F1E36'
    }
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    onCloseMobile();
  };

  const handleClearAll = async () => {
    setShowSettingsPopover(false);
    const confirmed = window.confirm(
      '⚠️ PERMANENT ACTION: Clear all application data?\n\nThis will permanently remove all stored records from all 11 CSV files while preserving file headers. Application state will be reset to a clean zero-data state.\n\nAre you sure you want to proceed?'
    );
    if (confirmed) {
      await clearAllData();
      onShowToast('All application data cleared permanently (zero-data state).', 'warn');
      navigate('/family-select');
      onCloseMobile();
    }
  };

  const handleLogout = () => {
    setShowSettingsPopover(false);
    logout();
    onShowToast('Signed out of family vault.', 'info');
    navigate('/login');
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : 'expanded'} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div
            className="sidebar-brand"
            onClick={() => handleNavClick('/home')}
            role="button"
            tabIndex={0}
            title="FamilyVault Portfolio"
          >
            <div className="sidebar-brand-icon">
              <Layers size={20} strokeWidth={2.4} />
            </div>
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">FamilyVault</span>
                <span className="sidebar-brand-subtitle">Portfolio V1</span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle (Expanded Mode) */}
          {!isCollapsed && (
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={17} strokeWidth={2} />
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            type="button"
            className="sidebar-mobile-close-btn"
            onClick={onCloseMobile}
            title="Close navigation"
            aria-label="Close navigation"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Sidebar Navigation Menu */}
        <nav className="sidebar-nav">
          {/* Desktop Expand Toggle (Collapsed Mode) */}
          {isCollapsed && (
            <button
              type="button"
              className="sidebar-expand-action-btn"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={18} strokeWidth={2} />
            </button>
          )}

          <div className="sidebar-nav-section-label">
            {!isCollapsed && <span>MAIN NAVIGATION</span>}
          </div>

          <ul className="sidebar-nav-list">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <li key={item.id} className="sidebar-nav-item-wrapper">
                  <button
                    type="button"
                    className={`sidebar-nav-item ${item.active ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.path)}
                    title={isCollapsed ? `${item.label}${item.count !== undefined ? ` (${item.count})` : ''}` : undefined}
                  >
                    <span className="sidebar-nav-icon">
                      <IconComponent size={19} strokeWidth={item.active ? 2.4 : 1.9} />
                    </span>

                    {!isCollapsed && (
                      <span className="sidebar-nav-label">{item.label}</span>
                    )}

                    {!isCollapsed && item.count !== undefined && (
                      <span
                        className="sidebar-nav-badge"
                        style={item.badgeColor ? { background: item.badgeColor } : undefined}
                      >
                        {item.count}
                      </span>
                    )}

                    {/* Collapsed dot indicator when items exist */}
                    {isCollapsed && item.count !== undefined && item.count > 0 && (
                      <span className="sidebar-collapsed-dot" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Bottom Footer: Settings & Profile */}
        <div className="sidebar-footer">
          {/* Settings Control Area */}
          <div className="sidebar-settings-wrap" ref={settingsRef}>
            <button
              type="button"
              className={`sidebar-footer-btn ${showSettingsPopover ? 'active' : ''}`}
              onClick={() => setShowSettingsPopover((prev) => !prev)}
              title={isCollapsed ? 'Settings & Data' : undefined}
            >
              <Settings size={18} strokeWidth={1.9} />
              {!isCollapsed && <span className="footer-btn-label">Settings & Vault</span>}
              {!isCollapsed && <ChevronRight size={14} className="footer-chevron" />}
            </button>

            {/* Settings Popover */}
            {showSettingsPopover && (
              <div className={`sidebar-settings-popover ${isCollapsed ? 'collapsed-pos' : ''}`}>
                <div className="settings-popover-header">
                  <ShieldCheck size={16} className="text-gold" />
                  <strong>Vault Management</strong>
                </div>

                <div className="settings-popover-actions">
                  <button
                    type="button"
                    className="settings-popover-item"
                    onClick={() => {
                      setShowSettingsPopover(false);
                      navigate('/family-select');
                      onCloseMobile();
                    }}
                  >
                    <Users size={16} />
                    <div>
                      <div className="item-title">Switch Family Member</div>
                      <div className="item-sub">Change active portfolio context</div>
                    </div>
                  </button>

                  <div className="settings-divider" />

                  <button
                    type="button"
                    className="settings-popover-item text-danger"
                    onClick={handleClearAll}
                  >
                    <Trash2 size={16} />
                    <div>
                      <div className="item-title">Clear All Data</div>
                      <div className="item-sub">Reset to zero-data state</div>
                    </div>
                  </button>
                </div>

                <div className="settings-popover-footer">
                  <span>FamilyVault v1.0 • CSV Engine</span>
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Logout Card */}
          <div className="sidebar-user-card">
            <div
              className="user-profile-clickable"
              onClick={() => {
                navigate('/family-select');
                onCloseMobile();
              }}
              title="Click to switch member"
              role="button"
              tabIndex={0}
            >
              <div className="user-avatar-chip">
                {activeMember?.avatar || '👤'}
              </div>

              {!isCollapsed && (
                <div className="user-details-col">
                  <strong className="user-name-text">
                    {activeMember?.name || 'User'}
                  </strong>
                  <span className="user-role-badge">
                    {activeMember?.role || 'Member'}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="user-logout-btn"
              onClick={handleLogout}
              title="Sign out of FamilyVault"
              aria-label="Sign out"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
