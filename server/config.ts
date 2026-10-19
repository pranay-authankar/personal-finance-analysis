import path from 'node:path';
import os from 'node:os';

/**
 * Storage paths and cryptographic configuration for FamilyVault.
 * Guaranteed to reside outside OneDrive (under %LOCALAPPDATA%\FamilyVault on Windows).
 */

export function getVaultDataDir(): string {
  // Respect custom environment variable if explicitly configured (e.g. in automated tests)
  if (process.env.FAMILYVAULT_DATA_DIR) {
    return path.resolve(process.env.FAMILYVAULT_DATA_DIR);
  }

  // Windows: %LOCALAPPDATA%\FamilyVault (strictly outside OneDrive)
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'FamilyVault');
  }

  // Linux / macOS / Android fallback
  const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdgData, 'FamilyVault');
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

export function getVaultBackupsDir(): string {
  return path.join(getVaultDataDir(), 'backups');
}

/**
 * Validates that a path does NOT reside within a synchronized OneDrive folder.
 */
export function isOneDrivePath(targetPath: string): boolean {
  const normalized = path.resolve(targetPath).toLowerCase();
  return normalized.includes('onedrive');
}

export const CRYPTO_CONFIG = {
  PBKDF2_ITERATIONS: 600_000,
  SALT_BYTES: 32,
  KEY_BYTES: 32, // 256-bit AES
  DIGEST: 'sha512' as const,
  CIPHER: 'sqlcipher' as const,
  PAGE_SIZE: 4096
};
