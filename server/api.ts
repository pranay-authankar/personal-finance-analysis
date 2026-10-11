import type { IncomingMessage, ServerResponse } from 'node:http';
import { vaultManager } from './auth.ts';
import { getVaultAttachmentsDir } from './config.ts';
import { clearManagedUploads } from './storage/clearManager.ts';

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

/**
 * Extracts Bearer token from Authorization header.
 */
function extractBearerToken(req: IncomingMessage): string | null {
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
      if (body.length > 10 * 1024 * 1024) {
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
 * Handles all /api/vault/* endpoints.
 */
export async function handleVaultApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const url = req.url || '';
  if (!url.startsWith('/api/vault/')) {
    next();
    return;
  }

  // 1. Strict loopback check
  if (!isLoopbackRequest(req)) {
    sendJson(res, 403, { error: 'Forbidden: Vault API only accepts local loopback connections.' });
    return;
  }

  // 2. Strict Origin/Host verification
  if (!isValidOriginAndHost(req)) {
    sendJson(res, 403, { error: 'Forbidden: Invalid Host or Origin header.' });
    return;
  }

  const endpoint = url.replace('/api/vault/', '').split('?')[0];

  try {
    // Public Vault Route 1: Status
    if (endpoint === 'status' && req.method === 'GET') {
      sendJson(res, 200, vaultManager.getStatus());
      return;
    }

    // Public Vault Route 2: Initialize
    if (endpoint === 'initialize' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const masterPassword = typeof body.masterPassword === 'string' ? body.masterPassword : '';
      if (!masterPassword || masterPassword.length < 8) {
        sendJson(res, 400, { error: 'Master password must be at least 8 characters long.' });
        return;
      }
      const result = vaultManager.initialize(masterPassword);
      sendJson(res, 200, result);
      return;
    }

    // Public Vault Route 3: Unlock
    if (endpoint === 'unlock' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const masterPassword = typeof body.masterPassword === 'string' ? body.masterPassword : '';
      if (!masterPassword) {
        sendJson(res, 400, { error: 'Master password is required.' });
        return;
      }
      const result = vaultManager.unlock(masterPassword);
      sendJson(res, 200, result);
      return;
    }

    // Authenticated Vault Route: Lock
    if (endpoint === 'lock' && req.method === 'POST') {
      vaultManager.lock();
      sendJson(res, 200, { success: true, isUnlocked: false });
      return;
    }

    // =========================================================================
    // Authenticated Database Endpoints (Require Bearer Session Token)
    // =========================================================================
    const token = extractBearerToken(req);
    if (!token || !vaultManager.validateSession(token)) {
      sendJson(res, 401, { error: 'Unauthorized: Valid vault session token required.' });
      return;
    }

    const db = vaultManager.getDatabase();

    // Query endpoint (Single SELECT or EXECUTE)
    if (endpoint === 'query' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const sql = typeof body.sql === 'string' ? body.sql.trim() : '';
      const params = Array.isArray(body.params) ? body.params : [];

      if (!sql) {
        sendJson(res, 400, { error: 'SQL query string is required.' });
        return;
      }

      if (sql.toUpperCase().startsWith('SELECT') || sql.toUpperCase().startsWith('PRAGMA')) {
        const stmt = db.prepare(sql);
        const rows = stmt.all(...params);
        sendJson(res, 200, { rows });
      } else {
        const stmt = db.prepare(sql);
        const info = stmt.run(...params);
        sendJson(res, 200, {
          changes: info.changes,
          lastInsertRowid: info.lastInsertRowid.toString()
        });
      }
      return;
    }

    // Batch Transaction Endpoint
    if (endpoint === 'batch' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const statements = Array.isArray(body.statements)
        ? (body.statements as Array<{ sql: string; params?: unknown[] }>)
        : [];

      if (statements.length === 0) {
        sendJson(res, 400, { error: 'No SQL statements provided.' });
        return;
      }

      const runBatch = db.transaction((ops: Array<{ sql: string; params?: unknown[] }>) => {
        let totalChanges = 0;
        for (const op of ops) {
          const stmt = db.prepare(op.sql);
          const info = stmt.run(...(op.params || []));
          totalChanges += info.changes;
        }
        return totalChanges;
      });

      const totalChanges = runBatch(statements);
      sendJson(res, 200, { success: true, totalChanges });
      return;
    }

    // Authenticated Vault Clear Endpoint
    if (endpoint === 'clear' && req.method === 'POST') {
      const clearVaultTables = db.transaction(() => {
        const tables = [
          'contributions',
          'documents',
          'payments',
          'asset_sales',
          'rents',
          'properties',
          'bullions',
          'post_office',
          'fds',
          'assets',
          'family_members'
        ];
        for (const t of tables) {
          db.prepare(`DELETE FROM ${t};`).run();
        }
      });
      clearVaultTables();

      const attachmentsDir = getVaultAttachmentsDir();
      const attachmentClearResult = clearManagedUploads(attachmentsDir);

      sendJson(res, 200, {
        success: true,
        vaultCleared: true,
        attachmentsCleared: attachmentClearResult
      });
      return;
    }

    sendJson(res, 404, { error: 'Vault endpoint not found.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = message.includes('Incorrect') || message.includes('denied') ? 401 : 500;
    sendJson(res, statusCode, { error: message });
  }
}
