import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Validates that an incoming HTTP connection originates strictly from local loopback.
 * Rejects external network interfaces (e.g. LAN IPs like 192.168.x.x, 10.x.x.x).
 */
export function isLoopbackRequest(req: IncomingMessage): boolean {
  const remoteAddress = req.socket?.remoteAddress;
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

/**
 * Validates Host and Origin headers to protect against DNS rebinding, CSRF,
 * and malicious cross-origin requests from external web pages.
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
 * Extracts Bearer token from the Authorization header.
 */
export function extractBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Sends a JSON response with strict security headers preventing caching of sensitive data.
 */
export function sendSecurityJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.end(JSON.stringify(data));
}
