import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Coins,
  CheckCircle2,
  Lock,
  KeyRound
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

  return (
    <div className="landing-standalone-container">
      {/* Top Navigation Bar */}
      <header className="landing-navbar">
        <div className="landing-nav-inner">
          <div className="landing-brand-group">
            <div className="landing-brand-icon-sm">
              <Layers size={22} strokeWidth={2.4} />
            </div>
            <div className="landing-brand-text">
              <span className="landing-brand-name">FamilyVault</span>
              <span className="landing-brand-tag">Private Finance</span>
            </div>
          </div>

          <div className="landing-nav-actions">
            <div className="landing-security-pill">
              <ShieldCheck size={14} color="var(--color-emerald)" />
              <span>100% Offline &amp; Private</span>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm landing-nav-login-btn"
              onClick={handleGetStarted}
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

      {/* Hero Section */}
      <main className="landing-hero-section">
        <div className="landing-hero-content">
          <div className="landing-brand-badge">
            <span className="badge-pulse-dot" />
            <span>OFFLINE-FIRST FINANCIAL VAULT</span>
          </div>

          <h1 className="landing-hero-title">
            Intelligent Wealth Tracking for the Modern Family
          </h1>

          <p className="landing-hero-lead">
            A private, self-hosted financial ledger designed to track family wealth across
            fixed deposits, post office savings schemes, physical bullions, and real estate.
          </p>

          <div className="landing-hero-cta-group">
            <button
              type="button"
              className="btn btn-primary btn-lg landing-hero-main-btn"
              onClick={handleGetStarted}
            >
              <span>{isVaultConfigured ? 'Unlock FamilyVault' : 'Set Up Master Password'}</span>
              <ArrowRight size={18} />
            </button>

            <div className="landing-hero-guarantee">
              <CheckCircle2 size={16} color="var(--color-emerald)" />
              <span>Zero Cloud · 100% Local CSV Storage</span>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="landing-features-grid">
          <div className="landing-feature-box">
            <div className="landing-feature-box-icon">
              <FileSpreadsheet size={24} color="var(--color-navy)" />
            </div>
            <h3>Authoritative CSV Storage</h3>
            <p>
              Transparent, human-readable records stored directly on your computer.
              No complex database servers, zero cloud dependency, and total data portability.
            </p>
          </div>

          <div className="landing-feature-box">
            <div className="landing-feature-box-icon">
              <ShieldCheck size={24} color="var(--color-gold)" />
            </div>
            <h3>Cryptographic Security</h3>
            <p>
              Protected by a strong master passphrase using PBKDF2-SHA512 key derivation with
              100,000 iterations. Zero plaintext credentials.
            </p>
          </div>

          <div className="landing-feature-box">
            <div className="landing-feature-box-icon">
              <Coins size={24} color="var(--color-navy)" />
            </div>
            <h3>Multi-Asset Tracking</h3>
            <p>
              Dedicated calculation engines for Fixed Deposits, Post Office schemes (MIS, SCSS, RD),
              Bullions (Gold &amp; Silver), and Real Estate receivables.
            </p>
          </div>
        </div>

        {/* Trust & Privacy Bar */}
        <div className="landing-trust-strip">
          <div className="trust-strip-item">
            <span className="trust-check">✓</span>
            <span>Zero external cloud servers</span>
          </div>
          <div className="trust-strip-item">
            <span className="trust-check">✓</span>
            <span>100% Local device ownership</span>
          </div>
          <div className="trust-strip-item">
            <span className="trust-check">✓</span>
            <span>Isolated localhost loopback API</span>
          </div>
          <div className="trust-strip-item">
            <span className="trust-check">✓</span>
            <span>Independent member portfolios</span>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="landing-footer">
        <p>FamilyVault • Clean CSV-Backed Architecture • Offline Desktop Prototype</p>
      </footer>
    </div>
  );
};
