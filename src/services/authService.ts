/**
 * FamilyVault — Authentication Service
 * Communicates with localhost Vite auth API (/api/auth/*) using PBKDF2-SHA512 session verification.
 * Zero database, zero plaintext passwords, 100% local.
 */

const TOKEN_STORAGE_KEY = 'familyvault_session_token';

export interface AuthStatusResponse {
  isConfigured: boolean;
  isAuthenticated: boolean;
}

export interface AuthActionResult {
  success: boolean;
  token?: string;
  error?: string;
}

class AuthService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);

    // Register auto-lock listener if running in Electron desktop app
    if (typeof window !== 'undefined' && window.vaultApi) {
      window.vaultApi.onLocked(() => {
        this.clearToken();
        if (typeof window !== 'undefined') {
          window.location.hash = '#/login';
          window.dispatchEvent(new CustomEvent('vault:locked'));
        }
      });
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public hasToken(): boolean {
    return Boolean(this.token);
  }

  private setToken(token: string): void {
    this.token = token;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  private clearToken(): void {
    this.token = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  private getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Fetches vault configuration status and current session validity.
   */
  public async getStatus(): Promise<AuthStatusResponse> {
    // 1. Electron Desktop Mode: query local encrypted SQLite vault state
    if (typeof window !== 'undefined' && window.vaultApi) {
      try {
        const status = await window.vaultApi.getStatus();
        if (status.isUnlocked) {
          this.setToken('electron_active_session');
        } else {
          this.clearToken();
        }
        return {
          isConfigured: status.isConfigured,
          isAuthenticated: status.isUnlocked
        };
      } catch {
        return { isConfigured: false, isAuthenticated: false };
      }
    }

    // 2. Web / Dev Mode: query Vite dev server auth API
    try {
      const res = await fetch('/api/auth/status', {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) {
        return { isConfigured: false, isAuthenticated: false };
      }
      const data = await res.json();
      if (!data.isAuthenticated && this.token) {
        this.clearToken();
      }
      return {
        isConfigured: Boolean(data.isConfigured),
        isAuthenticated: Boolean(data.isAuthenticated)
      };
    } catch {
      return { isConfigured: false, isAuthenticated: false };
    }
  }

  /**
   * Initial first-run setup: creates local master password credential and initializes vault.
   */
  public async setup(masterPassword: string): Promise<AuthActionResult> {
    // 1. Electron Desktop Mode: initialize encrypted SQLCipher database directly
    if (typeof window !== 'undefined' && window.vaultApi) {
      try {
        const res = await window.vaultApi.createVault(masterPassword);
        if (res.success) {
          this.setToken('electron_active_session');
          return { success: true, token: 'electron_active_session' };
        }
        return { success: false, error: res.error || 'Failed to initialize encrypted vault.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to initialize encrypted vault.';
        return { success: false, error: msg };
      }
    }

    // 2. Web / Dev Mode
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPassword })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        this.setToken(data.token);
        return { success: true, token: data.token };
      }
      return { success: false, error: data.error || 'Failed to setup master password.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error communicating with auth server.';
      return { success: false, error: msg };
    }
  }

  /**
   * Authenticates returning user and unlocks vault.
   */
  public async login(masterPassword: string): Promise<AuthActionResult> {
    // 1. Electron Desktop Mode: unlock encrypted SQLCipher database
    if (typeof window !== 'undefined' && window.vaultApi) {
      try {
        const res = await window.vaultApi.unlockVault(masterPassword);
        if (res.success) {
          this.setToken('electron_active_session');
          return { success: true, token: 'electron_active_session' };
        }
        return { success: false, error: res.error || 'Incorrect master password. Access denied.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to unlock encrypted vault.';
        return { success: false, error: msg };
      }
    }

    // 2. Web / Dev Mode
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPassword })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        this.setToken(data.token);
        return { success: true, token: data.token };
      }
      return { success: false, error: data.error || 'Incorrect master password. Access denied.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to local authentication service.';
      return { success: false, error: msg };
    }
  }

  /**
   * Verifies existing session validity.
   */
  public async verifySession(): Promise<boolean> {
    if (typeof window !== 'undefined' && window.vaultApi) {
      try {
        const status = await window.vaultApi.getStatus();
        return status.isUnlocked;
      } catch {
        return false;
      }
    }

    if (!this.token) return false;
    try {
      const res = await fetch('/api/auth/verify', {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.valid);
      }
      this.clearToken();
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Terminates active session and locks vault.
   */
  public async logout(): Promise<void> {
    if (typeof window !== 'undefined' && window.vaultApi) {
      try {
        await window.vaultApi.lockVault();
      } catch {
        // ignore
      }
      this.clearToken();
      return;
    }

    if (this.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    this.clearToken();
  }
}

export const authService = new AuthService();
