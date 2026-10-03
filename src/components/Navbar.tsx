import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { Layers, PieChart, Landmark, Mail, RotateCcw, LogOut, ChevronDown } from 'lucide-react';

interface NavbarProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeMember, logout, resetDemoData, isAuthenticated } = useInvestments();

  if (!isAuthenticated) return null;

  const isHome = location.pathname === '/home';
  const isFds = location.pathname.startsWith('/fds');
  const isPostOffice = location.pathname.startsWith('/post-office');
  const fdCount = activeMember?.fds?.length || 0;
  const poCount = activeMember?.postOfficeInvestments?.length || 0;

  const handleReset = () => {
    if (window.confirm('Reset all investment data back to clean family sample records?')) {
      resetDemoData();
      onShowToast('Demo data reloaded successfully!', 'success');
      navigate('/home');
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
            <span>Portfolio Overview</span>
          </button>

          <button
            className={`nav-tab ${isFds ? 'active' : ''}`}
            onClick={() => navigate('/fds')}
          >
            <Landmark size={18} strokeWidth={2} />
            <span>Fixed Deposits (FDs)</span>
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
        </nav>

        {/* Right Side: Active Member Switcher & Utilities */}
        <div className="nav-user-actions">
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
            onClick={handleReset}
            title="Reset to default demo investments"
          >
            <RotateCcw size={15} />
            <span>Reset Demo</span>
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
