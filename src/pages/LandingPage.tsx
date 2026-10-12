import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import {
  Layers,
  ArrowRight,
  Landmark,
  Mail,
  Coins,
  Building,
  Wallet,
  Lock,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

interface LandingPageProps {
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const navigate = useNavigate();
  const { isVaultConfigured } = useInvestments();

  const handleGetStarted = () => {
    navigate('/login');
  };

  const assetHighlights = [
    {
      title: 'Fixed Deposits',
      subtitle: 'Bank deposits & maturity tracking',
      icon: Landmark,
      color: 'var(--color-navy)',
      bg: '#EFF6FF',
      border: '#BFDBFE'
    },
    {
      title: 'Post Office Savings',
      subtitle: 'MIS payouts, SCSS & RD schedules',
      icon: Mail,
      color: '#A16207',
      bg: '#FEFCE8',
      border: '#FEF08A'
    },
    {
      title: 'Physical Bullions',
      subtitle: 'Gold, silver & precious metal holdings',
      icon: Coins,
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A'
    },
    {
      title: 'Real Estate',
      subtitle: 'Land, commercial properties & deadlines',
      icon: Building,
      color: '#4F46E5',
      bg: '#EEF2FF',
      border: '#C7D2FE'
    },
    {
      title: 'Realized Capital',
      subtitle: 'Liquid proceeds from sales & maturities',
      icon: Wallet,
      color: '#0F766E',
      bg: '#F0FDFA',
      border: '#99F6E4'
    }
  ];

  return (
    <div className="landing-standalone-container">
      {/* Top Navigation Bar */}
      <header className="landing-navbar">
        <div className="landing-nav-inner">
          <div className="landing-brand-group">
            <div className="landing-brand-icon-box">
              <Layers size={20} strokeWidth={2.4} />
            </div>
            <div>
              <span className="landing-brand-title">FamilyVault</span>
            </div>
          </div>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleGetStarted}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px' }}
            >
              {isVaultConfigured ? (
                <>
                  <Lock size={14} />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  <span>Get Started</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Clean Hero Section */}
      <main className="landing-hero-section">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-light)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-navy)', marginBottom: '18px' }}>
          <ShieldCheck size={14} color="var(--color-emerald)" />
          <span>Private Family Wealth Management</span>
        </div>

        <h1 className="landing-hero-title" style={{ margin: '0 0 14px 0', fontSize: 'clamp(34px, 5vw, 52px)', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          FamilyVault
        </h1>

        <p className="landing-hero-lead" style={{ margin: '0 0 32px 0', fontSize: 'clamp(15px, 2vw, 17px)', color: 'var(--color-charcoal-muted)', maxWidth: '520px', lineHeight: 1.5 }}>
          Private, device-local wealth and investment tracking across all family assets.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '64px' }}>
          <button
            type="button"
            className="btn btn-primary btn-lg landing-hero-main-btn"
            onClick={handleGetStarted}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontSize: '15px', fontWeight: 700, borderRadius: '10px' }}
          >
            <span>{isVaultConfigured ? 'Unlock Vault' : 'Get Started'}</span>
            <ArrowRight size={17} />
          </button>
        </div>

        {/* Visual Asset Section Highlights (No real data, no fake figures) */}
        <div
          style={{
            width: '100%',
            maxWidth: '1080px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            textAlign: 'left'
          }}
        >
          {assetHighlights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: item.bg,
                    border: `1px solid ${item.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color
                  }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)', margin: '0 0 2px 0' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-charcoal-muted)', margin: 0, lineHeight: 1.4 }}>
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="landing-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--color-charcoal-muted)' }}>
        <p style={{ margin: 0 }}>FamilyVault · Private Financial Portfolio</p>
      </footer>
    </div>
  );
};
