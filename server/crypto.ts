import crypto from 'node:crypto';
import fs from 'node:fs';
import { CRYPTO_CONFIG, getVaultMetaPath } from './config.ts';

export interface VaultMetadata {
  version: number;
  kdf: {
    algorithm: string;
    iterations: number;
    saltHex: string;
    digest: string;
  };
  cipher: string;
  createdAt: string;
  lastUnlockedAt?: string;
}

/**
 * Derives a 256-bit Master Encryption Key (MEK) buffer using PBKDF2-HMAC-SHA512 (600,000 iterations).
 */
export function deriveEncryptionKey(masterPassword: string, salt: Buffer): Buffer {
  if (!masterPassword || masterPassword.length < 8) {
    throw new Error('Master password must be at least 8 characters long.');
  }
  return crypto.pbkdf2Sync(
    masterPassword,
    salt,
    CRYPTO_CONFIG.PBKDF2_ITERATIONS,
    CRYPTO_CONFIG.KEY_BYTES,
    CRYPTO_CONFIG.DIGEST
  );
}

/**
 * Securely overwrites an in-memory key buffer with zeroes.
 */
export function wipeBuffer(buffer: Buffer | null | undefined): void {
  if (buffer && Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  }
}

/**
 * Reads vault metadata from disk if it exists.
 */
export function readVaultMetadata(): VaultMetadata | null {
  const metaPath = getVaultMetaPath();
  if (fs.existsSync(metaPath)) {
    try {
      const content = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(content) as VaultMetadata;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Writes or updates vault metadata on disk.
 */
import path from 'node:path';

export function writeVaultMetadata(meta: VaultMetadata): void {
  const metaPath = getVaultMetaPath();
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}
