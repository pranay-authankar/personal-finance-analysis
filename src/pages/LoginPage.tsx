import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import { ShieldCheck, Eye, EyeOff, ArrowRight, Layers } from 'lucide-react';

interface LoginPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { login } = useInvestments();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(pin)) {
      onShowToast('Login successful! Welcome to FamilyVault.', 'success');
      navigate('/family-select');
    } else {
      onShowToast('Please enter a 4-digit PIN (e.g. 1234)', 'warn');
    }
  };

  const handleQuickEntry = () => {
    login('1234');
    onShowToast('Signed in with Family Demo Account.', 'success');
    navigate('/family-select');
  };

  return (
    <div className="login-page-container">
      <div className="login-card-desktop fade-in">
        <div className="login-badge-header">
          <div className="login-brand-icon">
            <Layers size={34} strokeWidth={2.5} />
          </div>
          <h1 className="login-title">FamilyVault</h1>
          <p className="login-tagline">Family Investment &amp; Fixed Deposit Tracker</p>
          <div className="security-chip">
            <ShieldCheck size={14} color="var(--brand-primary)" />
            <span>100% Private · Zero cloud sync · Local desktop prototype</span>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="loginPinInput" className="form-label">
              <span>Enter Family Security PIN</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default: 1234</span>
            </label>
            <div className="pin-input-group">
              <input
                id="loginPinInput"
                type={showPin ? 'text' : 'password'}
                maxLength={8}
                placeholder="••••"
                className="form-input pin-input"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="pin-toggle-btn"
                onClick={() => setShowPin(!showPin)}
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}>
            <span>Sign In to Vault</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="login-divider">or quick preview</div>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%' }}
          onClick={handleQuickEntry}
        >
          Quick Entry (Demo Mode)
        </button>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          Tip: Select from pre-loaded family profiles for Rajesh (Dad), Sunita (Mom), or Pranav (Self).
        </div>
      </div>
    </div>
  );
};
