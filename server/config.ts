import path from 'node:path';
import os from 'node:os';

/**
 * Storage paths and configuration for FamilyVault.
 * Guaranteed to reside outside OneDrive (in %LOCALAPPDATA%\FamilyVault).
 */

export function getVaultDataDir(): string {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(localAppData, 'FamilyVault');
}

export function getVaultDbPath(): string {
  return path.join(getVaultDataDir(), 'familyvault.db');
}

export function getVaultMetaPath(): string {
  return path.join(getVaultDataDir(), 'vault_meta.json');
}

export function getVaultAttachmentsDir(): string {
  return path.join(getVaultDataDir(), 'attachments');
}

export const CRYPTO_CONFIG = {
  PBKDF2_ITERATIONS: 600000,
  SALT_BYTES: 32,
  KEY_BYTES: 32,
  DIGEST: 'sha512' as const,
  CIPHER: 'sqlcipher' as const
};
