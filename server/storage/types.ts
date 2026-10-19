/**
 * Platform-agnostic storage interfaces and types for FamilyVault.
 * Defines the contract implemented by Windows desktop (better-sqlite3-multiple-ciphers)
 * and future mobile (Android native SQLCipher / Keystore).
 */

export interface VaultMetadata {
  version: number;
  kdf: {
    algorithm: string;
    iterations: number;
    saltHex: string;
    digest: string;
  };
  cipher: string;
  pageSize: number;
  createdAt: string;
  lastUnlockedAt?: string;
}

export interface StatementResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface IPreparedStatement {
  run(...params: unknown[]): StatementResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

/**
 * Common abstraction for an encrypted SQLite database connection.
 */
export interface IVaultDatabase {
  exec(sql: string): void;
  prepare(sql: string): IPreparedStatement;
  transaction<T>(fn: () => T): T;
  pragma(pragmaStr: string, options?: { simple?: boolean }): unknown;
  close(): void;
  isOpen(): boolean;
  verifyConnection(): boolean;
}

/**
 * Storage Engine managing the lifecycle of the encrypted database (unlock, lock, status).
 */
export interface IStorageEngine {
  initialize(masterPassword: string, customPath?: string): Promise<{ db: IVaultDatabase; keyHex: string }>;
  unlock(masterPassword: string, customPath?: string): Promise<{ db: IVaultDatabase; keyHex: string }>;
  lock(): void;
  isUnlocked(): boolean;
  getDb(): IVaultDatabase | null;
  getDbPath(): string;
}

/**
 * Encrypted Document Attachment Storage Specification.
 * Protects PDFs, receipts, deeds, and image documents using AES-256-GCM authenticated encryption.
 */
export interface StoredDocumentMeta {
  docId: string;
  originalName: string;
  storedFileName: string;
  mimeType?: string;
  fileSizeBytes: number;
  encryptedSizeBytes: number;
  sha256Hash: string;
  createdAt: string;
}

export interface IEncryptedDocumentStorage {
  /**
   * Stores an attachment encrypted on disk using authenticated AES-256-GCM.
   * Derives a dedicated document subkey from the Master Encryption Key (MEK).
   */
  storeEncryptedDocument(
    docId: string,
    originalName: string,
    fileBuffer: Buffer,
    mek: Buffer,
    mimeType?: string
  ): Promise<StoredDocumentMeta>;

  /**
   * Retrieves and decrypts a document attachment into memory.
   * Throws an error if authentication tag verification fails (tamper detection).
   */
  retrieveEncryptedDocument(
    docId: string,
    mek: Buffer
  ): Promise<{ originalName: string; mimeType: string; content: Buffer }>;

  /**
   * Securely deletes an encrypted document file from storage.
   */
  deleteEncryptedDocument(docId: string): Promise<boolean>;

  /**
   * Verifies that the encrypted document file exists and is not corrupted or truncated.
   */
  verifyDocumentIntegrity(docId: string, mek: Buffer): Promise<boolean>;
}

/**
 * Vault Backup & Restore Interface Specification.
 * Enables creating password-protected, encrypted portable archive backups (.fvault)
 * containing the encrypted SQLite database and all encrypted attachment files.
 */
export interface BackupManifest {
  manifestVersion: number;
  vaultVersion: number;
  createdAt: string;
  databaseSha256: string;
  documentsCount: number;
  totalSizeBytes: number;
  encryptedWithCustomPassphrase: boolean;
}

export interface RestoreReport {
  success: boolean;
  recordsRestored: number;
  documentsRestored: number;
  timestamp: string;
  targetDbPath: string;
}

export interface IBackupRestoreManager {
  /**
   * Creates an atomic, encrypted backup bundle of the vault and all attachments.
   */
  createBackup(
    destinationPath: string,
    mek: Buffer,
    customBackupPassphrase?: string
  ): Promise<BackupManifest>;

  /**
   * Restores a vault backup archive into target location.
   */
  restoreBackup(
    archivePath: string,
    mekOrPassphrase: Buffer | string,
    targetDirectory?: string
  ): Promise<RestoreReport>;

  /**
   * Validates the integrity and manifest of a backup archive without writing to production storage.
   */
  verifyBackupArchive(archivePath: string): Promise<BackupManifest>;
}
