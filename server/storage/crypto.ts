import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CRYPTO_CONFIG, getVaultMetaPath } from '../config.ts';
import type { VaultMetadata } from './types.ts';

/**
 * Derives a 256-bit Master Encryption Key (MEK) buffer using PBKDF2-HMAC-SHA512 (600,000 iterations).
 * Never stores or exposes the derived key to the frontend.
 */
export function deriveEncryptionKey(masterPassword: string, salt: Buffer): Buffer {
  if (!masterPassword || typeof masterPassword !== 'string' || masterPassword.length < 8) {
    throw new Error('Master password must be at least 8 characters long.');
  }
  if (!salt || !Buffer.isBuffer(salt) || salt.length !== CRYPTO_CONFIG.SALT_BYTES) {
    throw new Error(`Salt must be a valid Buffer of exactly ${CRYPTO_CONFIG.SALT_BYTES} bytes.`);
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
 * Derives a cryptographically separated 256-bit subkey from the Master Encryption Key (MEK)
 * specifically for document attachment encryption using HKDF (RFC 5869).
 */
export function deriveDocumentSubkey(mek: Buffer): Buffer {
  if (!mek || !Buffer.isBuffer(mek) || mek.length !== 32) {
    throw new Error('MEK must be a valid 32-byte Buffer.');
  }

  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      mek,
      Buffer.alloc(0), // empty salt since MEK is already high-entropy
      Buffer.from('FamilyVault-Document-Encryption-v1', 'utf8'),
      32
    )
  );
}

/**
 * Generates a cryptographically strong 32-byte random salt.
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(CRYPTO_CONFIG.SALT_BYTES);
}

/**
 * Securely overwrites an in-memory key buffer with zeroes.
 * Prevents key remnants from lingering in Node.js process memory after lock.
 */
export function wipeBuffer(buffer: Buffer | null | undefined): void {
  if (buffer && Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  }
}

/**
 * Reads vault metadata from disk if it exists.
 */
export function readVaultMetadata(customMetaPath?: string): VaultMetadata | null {
  const metaPath = customMetaPath || getVaultMetaPath();
  if (!fs.existsSync(metaPath)) return null;

  try {
    const content = fs.readFileSync(metaPath, 'utf8');
    return JSON.parse(content) as VaultMetadata;
  } catch {
    return null;
  }
}

/**
 * Writes or updates vault metadata on disk.
 */
export function writeVaultMetadata(meta: VaultMetadata, customMetaPath?: string): void {
  const metaPath = customMetaPath || getVaultMetaPath();
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

/**
 * Encrypts arbitrary binary data using AES-256-GCM authenticated encryption.
 */
export function encryptBlob(
  data: Buffer,
  key: Buffer
): { iv: Buffer; authTag: Buffer; ciphertext: Buffer } {
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (256-bit).');
  }

  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { iv, authTag, ciphertext };
}

/**
 * Decrypts AES-256-GCM ciphertext. Throws an error if authentication tag verification fails.
 */
export function decryptBlob(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  if (key.length !== 32) {
    throw new Error('Decryption key must be exactly 32 bytes (256-bit).');
  }
  if (iv.length !== 12) {
    throw new Error('IV must be exactly 12 bytes.');
  }
  if (authTag.length !== 16) {
    throw new Error('Auth tag must be exactly 16 bytes.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
