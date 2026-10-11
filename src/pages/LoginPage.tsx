import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInvestments } from '../context/InvestmentContext';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Layers,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface LoginPageProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { login, setupVault, isVaultConfigured } = useInvestments();

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password strength calculation
  const getPasswordStrength = (pwd: string): { label: string; score: number; color: string } => {
    if (!pwd) return { label: 'Empty', score: 0, color: 'var(--border-light)' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { label: 'Weak', score, color: 'var(--color-rose)' };
    if (score <= 4) return { label: 'Moderate', score, color: 'var(--color-amber)' };
    return { label: 'Strong', score, color: 'var(--color-emerald)' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isVaultConfigured) {
      // First-time setup flow
      if (password.length < 8) {
        setErrorMessage('Master password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter to confirm.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await setupVault(password);
        if (res.success) {
          onShowToast('Vault master password configured successfully! Welcome to FamilyVault.', 'success');
          // Navigate to Members page as default destination
          navigate('/family-select');
        } else {
          setErrorMessage(res.error || 'Failed to setup vault master password.');
        }
      } catch {
        setErrorMessage('An unexpected error occurred while configuring the vault.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Returning user login flow
      if (!password) {
        setErrorMessage('Please enter your master password.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await login(password);
        if (res.success) {
          onShowToast('Vault unlocked successfully! Welcome back.', 'success');
          // Navigate to Members page as default destination
          navigate('/family-select');
        } else {
          setErrorMessage(res.error || 'Incorrect master password. Access denied.');
        }
      } catch {
        setErrorMessage('An unexpected error occurred while verifying credentials.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="login-standalone-container">
      {/* Back to Landing link */}
      <div className="login-top-bar">
        <Link to="/" className="login-back-link">
          <ArrowLeft size={16} />
          <span>Back to Overview</span>
        </Link>
      </div>

      <div className="login-card-wrapper fade-in">
        <div className="vault-auth-card">
          {/* Header */}
          <div className="auth-card-top">
            <div className="auth-lock-icon">
              {isVaultConfigured ? <Lock size={24} /> : <KeyRound size={24} />}
            </div>
            <div>
              <div className="login-brand-micro">
                <Layers size={14} />
                <span>FamilyVault</span>
              </div>
              <h2 className="auth-card-title">
                {isVaultConfigured ? 'Unlock FamilyVault' : 'Set Up Vault Master Password'}
              </h2>
              <p className="auth-card-subtitle">
                {isVaultConfigured
                  ? 'Enter your master passphrase to access your family investment records.'
                  : 'Create a strong master passphrase. It will be salted and hashed locally on your device.'}
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="auth-alert-box auth-alert-error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span className="alert-text">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="vault-auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="vaultMasterPasswordInput" className="form-label">
                <span>{isVaultConfigured ? 'Master Password' : 'Create Master Password'}</span>
                {!isVaultConfigured && (
                  <span className="form-label-hint">Min. 8 characters</span>
                )}
              </label>
              <div className="auth-password-input-wrap">
                <input
                  id="vaultMasterPasswordInput"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input auth-password-input ${errorMessage ? 'has-error' : ''}`}
                  placeholder={isVaultConfigured ? 'Enter your master password' : 'Choose a strong password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete={isVaultConfigured ? 'current-password' : 'new-password'}
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle-action"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Strength Indicator (Only for initial setup) */}
              {!isVaultConfigured && password.length > 0 && (
                <div className="password-strength-container">
                  <div className="strength-meter-bar">
                    <div
                      className="strength-meter-fill"
                      style={{
                        width: `${Math.min(100, (strength.score / 5) * 100)}%`,
                        backgroundColor: strength.color
                      }}
                    />
                  </div>
                  <div className="strength-label">
                    <span>Security:</span>
                    <strong style={{ color: strength.color }}>{strength.label}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field (Only for initial setup) */}
            {!isVaultConfigured && (
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="confirmVaultPasswordInput" className="form-label">
                  <span>Confirm Master Password</span>
                </label>
                <div className="auth-password-input-wrap">
                  <input
                    id="confirmVaultPasswordInput"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input auth-password-input ${
                      confirmPassword && confirmPassword !== password ? 'has-error' : ''
                    }`}
                    placeholder="Re-enter password to confirm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
                {confirmPassword && confirmPassword === password && (
                  <div className="password-match-indicator">
                    <CheckCircle2 size={14} color="var(--color-emerald)" />
                    <span>Passwords match</span>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg auth-submit-btn"
              disabled={isLoading || (!isVaultConfigured && (password.length < 8 || password !== confirmPassword))}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="spinner-icon" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>{isVaultConfigured ? 'Sign In to Vault' : 'Secure & Initialize Vault'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="auth-card-footer">
            <ShieldCheck size={15} color="var(--color-gold)" />
            <span>Verified locally with PBKDF2-SHA512 (100,000 iterations)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
