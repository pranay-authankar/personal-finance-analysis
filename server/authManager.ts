import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface StoredCredential {
  saltHex: string;
  hashHex: string;
  iterations: number;
  keylen: number;
  digest: string;
  createdAt: string;
}

interface ActiveSession {
  createdAt: number;
  lastAccessedAt: number;
}

const AUTH_FILE_NAME = '.familyvault_auth.json';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

class AuthManager {
  private activeSessions = new Map<string, ActiveSession>();
  private failedAttempts = 0;
  private lockoutUntil = 0;

  private getAuthFilePath(): string {
    return path.resolve(process.cwd(), AUTH_FILE_NAME);
  }

  public isConfigured(): boolean {
    return fs.existsSync(this.getAuthFilePath());
  }

  private readCredential(): StoredCredential | null {
    const filePath = this.getAuthFilePath();
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as StoredCredential;
    } catch {
      return null;
    }
  }

  public setup(password: string): { success: boolean; token?: string; error?: string } {
    if (this.isConfigured()) {
      return { success: false, error: 'Vault authentication is already configured.' };
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return { success: false, error: 'Master password must be at least 8 characters long.' };
    }

    const salt = crypto.randomBytes(32);
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST);

    const credential: StoredCredential = {
      saltHex: salt.toString('hex'),
      hashHex: hash.toString('hex'),
      iterations: PBKDF2_ITERATIONS,
      keylen: KEY_LENGTH,
      digest: DIGEST,
      createdAt: new Date().toISOString()
    };

    const filePath = this.getAuthFilePath();
    fs.writeFileSync(filePath, JSON.stringify(credential, null, 2), { mode: 0o600 });

    const token = this.createSession();
    return { success: true, token };
  }

  public login(password: string): { success: boolean; token?: string; error?: string } {
    const now = Date.now();
    if (this.lockoutUntil > now) {
      const waitSeconds = Math.ceil((this.lockoutUntil - now) / 1000);
      return {
        success: false,
        error: `Too many failed attempts. Please wait ${waitSeconds} second(s) before retrying.`
      };
    }

    const cred = this.readCredential();
    if (!cred) {
      return { success: false, error: 'Vault authentication is not yet configured.' };
    }

    if (!password || typeof password !== 'string') {
      return { success: false, error: 'Password is required.' };
    }

    const salt = Buffer.from(cred.saltHex, 'hex');
    const expectedHash = Buffer.from(cred.hashHex, 'hex');
    const actualHash = crypto.pbkdf2Sync(password, salt, cred.iterations, cred.keylen, cred.digest);

    if (actualHash.length !== expectedHash.length || !crypto.timingSafeEqual(actualHash, expectedHash)) {
      this.failedAttempts += 1;
      if (this.failedAttempts >= 5) {
        this.lockoutUntil = Date.now() + 15_000; // 15s lockout after 5 failures
      }
      return { success: false, error: 'Incorrect master password. Access denied.' };
    }

    // Success: reset rate limiting
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
    const token = this.createSession();
    return { success: true, token };
  }

  public validateSession(token: string): boolean {
    if (!token) return false;
    const session = this.activeSessions.get(token);
    if (!session) return false;

    const now = Date.now();
    if (now - session.lastAccessedAt > SESSION_EXPIRY_MS) {
      this.activeSessions.delete(token);
      return false;
    }

    session.lastAccessedAt = now;
    return true;
  }

  public invalidateSession(token: string): void {
    if (token) {
      this.activeSessions.delete(token);
    }
  }

  private createSession(): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.activeSessions.set(token, {
      createdAt: now,
      lastAccessedAt: now
    });
    return token;
  }
}

export const authManager = new AuthManager();

/**
 * Checks if request comes strictly from local loopback (127.0.0.1 or ::1).
 */
export function isLoopbackRequest(req: IncomingMessage): boolean {
  const remoteAddress = req.socket.remoteAddress;
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

/**
 * Validates Host and Origin headers to protect against DNS rebinding and CSRF.
 */
export function isValidOriginAndHost(req: IncomingMessage): boolean {
  const host = req.headers.host || '';
  const isAllowedHost =
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]');

  if (!isAllowedHost) return false;

  const origin = req.headers.origin;
  if (origin) {
    const isAllowedOrigin =
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.startsWith('http://[::1]');
    if (!isAllowedOrigin) return false;
  }

  return true;
}

export function extractBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handles all /api/auth/* endpoints.
 */
export async function handleAuthApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const url = req.url || '';
  if (!url.startsWith('/api/auth/')) {
    next();
    return;
  }

  if (!isLoopbackRequest(req)) {
    sendJson(res, 403, { error: 'Forbidden: Auth API only accepts local loopback connections.' });
    return;
  }

  if (!isValidOriginAndHost(req)) {
    sendJson(res, 403, { error: 'Forbidden: Invalid Host or Origin header.' });
    return;
  }

  const endpoint = url.replace('/api/auth/', '').split('?')[0];

  try {
    // 1. Status: GET /api/auth/status
    if (endpoint === 'status' && req.method === 'GET') {
      const isConfigured = authManager.isConfigured();
      const token = extractBearerToken(req);
      const isAuthenticated = token ? authManager.validateSession(token) : false;
      sendJson(res, 200, { isConfigured, isAuthenticated });
      return;
    }

    // 2. Setup: POST /api/auth/setup
    if (endpoint === 'setup' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const password = typeof body.masterPassword === 'string' ? body.masterPassword : '';
      const result = authManager.setup(password);
      sendJson(res, result.success ? 200 : 400, result);
      return;
    }

    // 3. Login: POST /api/auth/login
    if (endpoint === 'login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const password = typeof body.masterPassword === 'string' ? body.masterPassword : '';
      const result = authManager.login(password);
      sendJson(res, result.success ? 200 : 401, result);
      return;
    }

    // 4. Verify: GET /api/auth/verify
    if (endpoint === 'verify' && req.method === 'GET') {
      const token = extractBearerToken(req);
      if (!token || !authManager.validateSession(token)) {
        sendJson(res, 401, { valid: false, error: 'Invalid or expired session token.' });
        return;
      }
      sendJson(res, 200, { valid: true });
      return;
    }

    // 5. Logout: POST /api/auth/logout
    if (endpoint === 'logout' && req.method === 'POST') {
      const token = extractBearerToken(req);
      if (token) {
        authManager.invalidateSession(token);
      }
      sendJson(res, 200, { success: true });
      return;
    }

    sendJson(res, 404, { error: 'Auth endpoint not found.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: message });
  }
}
