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
   * Initial first-run setup: creates local master password credential.
   */
  public async setup(masterPassword: string): Promise<AuthActionResult> {
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
   * Authenticates returning user against local PBKDF2 hash.
   */
  public async login(masterPassword: string): Promise<AuthActionResult> {
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
   * Verifies existing session token against server memory.
   */
  public async verifySession(): Promise<boolean> {
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
   * Terminates active session.
   */
  public async logout(): Promise<void> {
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
