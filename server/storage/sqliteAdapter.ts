import DatabaseConstructor from 'better-sqlite3-multiple-ciphers';
import type { Database as BetterSqliteDatabase, Statement as BetterSqliteStatement } from 'better-sqlite3-multiple-ciphers';
import fs from 'node:fs';
import path from 'node:path';
import { CRYPTO_CONFIG, getVaultDbPath, getVaultMetaPath } from '../config.ts';
import {
  deriveEncryptionKey,
  generateSalt,
  readVaultMetadata,
  writeVaultMetadata,
  wipeBuffer
} from './crypto.ts';
import { SCHEMA_SQL } from './schema.ts';
import type {
  IVaultDatabase,
  IStorageEngine,
  IPreparedStatement,
  StatementResult,
  VaultMetadata
} from './types.ts';

/**
 * Adapter wrapping a single prepared statement into the platform-agnostic IPreparedStatement interface.
 */
class PreparedStatementAdapter implements IPreparedStatement {
  private stmt: BetterSqliteStatement;

  constructor(stmt: BetterSqliteStatement) {
    this.stmt = stmt;
  }

  public run(...params: unknown[]): StatementResult {
    const result = this.stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  public get(...params: unknown[]): Record<string, unknown> | undefined {
    return this.stmt.get(...params) as Record<string, unknown> | undefined;
  }

  public all(...params: unknown[]): Record<string, unknown>[] {
    return this.stmt.all(...params) as Record<string, unknown>[];
  }
}

/**
 * Adapter wrapping the native BetterSqliteDatabase instance into the IVaultDatabase interface.
 */
export class SqliteVaultDatabase implements IVaultDatabase {
  private _isOpen = true;
  private rawDb: BetterSqliteDatabase;

  constructor(rawDb: BetterSqliteDatabase) {
    this.rawDb = rawDb;
  }

  public exec(sql: string): void {
    if (!this._isOpen) throw new Error('Database is closed.');
    this.rawDb.exec(sql);
  }

  public prepare(sql: string): IPreparedStatement {
    if (!this._isOpen) throw new Error('Database is closed.');
    const stmt = this.rawDb.prepare(sql);
    return new PreparedStatementAdapter(stmt);
  }

  public transaction<T>(fn: () => T): T {
    if (!this._isOpen) throw new Error('Database is closed.');
    const tx = this.rawDb.transaction(fn);
    return tx();
  }

  public pragma(pragmaStr: string, options?: { simple?: boolean }): unknown {
    if (!this._isOpen) throw new Error('Database is closed.');
    return this.rawDb.pragma(pragmaStr, options);
  }

  public close(): void {
    if (this._isOpen) {
      try {
        this.rawDb.close();
      } finally {
        this._isOpen = false;
      }
    }
  }

  public isOpen(): boolean {
    return this._isOpen && this.rawDb.open;
  }

  public verifyConnection(): boolean {
    if (!this._isOpen) return false;
    try {
      const res = this.rawDb
        .prepare('SELECT count(*) as count FROM sqlite_master;')
        .get() as { count: number };
      return typeof res?.count === 'number';
    } catch {
      return false;
    }
  }

  /**
   * Access to raw underlying driver if needed for advanced platform-specific tasks.
   */
  public getRawDatabase(): BetterSqliteDatabase {
    return this.rawDb;
  }
}

/**
 * Opens an encrypted SQLCipher database connection with strict PRAGMAs.
 */
export function openEncryptedDatabase(
  dbPath: string = getVaultDbPath(),
  keyHex: string
): SqliteVaultDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const raw = new DatabaseConstructor(dbPath);

  // Set encryption key and cipher parameters immediately before any queries
  raw.pragma(`key = '${keyHex}'`);
  raw.pragma("cipher = 'sqlcipher'");
  raw.pragma('cipher_page_size = 4096');
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('synchronous = NORMAL');

  return new SqliteVaultDatabase(raw);
}

/**
 * Initializes the schema inside an opened encrypted database.
 */
export function initializeSchema(db: IVaultDatabase): void {
  db.exec(SCHEMA_SQL);
}

/**
 * Full implementation of IStorageEngine managing unlock, initialization, and memory locking.
 */
export class SqliteStorageEngine implements IStorageEngine {
  private activeDb: SqliteVaultDatabase | null = null;
  private cachedKeyBuffer: Buffer | null = null;
  private currentDbPath: string = getVaultDbPath();

  public getDbPath(): string {
    return this.currentDbPath;
  }

  public isUnlocked(): boolean {
    return this.activeDb !== null && this.activeDb.isOpen();
  }

  public getDb(): IVaultDatabase | null {
    return this.activeDb;
  }

  public getKeyBuffer(): Buffer | null {
    return this.cachedKeyBuffer;
  }

  /**
   * Initializes a brand-new encrypted vault database.
   */
  public async initialize(
    masterPassword: string,
    customPath?: string
  ): Promise<{ db: IVaultDatabase; keyHex: string }> {
    const targetDbPath = customPath || getVaultDbPath();
    const targetMetaPath = customPath
      ? path.join(path.dirname(customPath), 'vault_meta.json')
      : getVaultMetaPath();

    this.currentDbPath = targetDbPath;

    // Check if metadata already exists
    const existingMeta = readVaultMetadata(targetMetaPath);
    if (existingMeta && fs.existsSync(targetDbPath)) {
      throw new Error('Vault is already initialized at this location.');
    }

    // Generate random 32-byte salt
    const salt = generateSalt();
    const keyBuffer = deriveEncryptionKey(masterPassword, salt);
    const keyHex = keyBuffer.toString('hex');

    // Create database and initialize schema
    const db = openEncryptedDatabase(targetDbPath, keyHex);
    initializeSchema(db);

    // Save metadata
    const meta: VaultMetadata = {
      version: 1,
      kdf: {
        algorithm: 'PBKDF2-HMAC-SHA512',
        iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
        saltHex: salt.toString('hex'),
        digest: CRYPTO_CONFIG.DIGEST
      },
      cipher: CRYPTO_CONFIG.CIPHER,
      pageSize: CRYPTO_CONFIG.PAGE_SIZE,
      createdAt: new Date().toISOString(),
      lastUnlockedAt: new Date().toISOString()
    };
    writeVaultMetadata(meta, targetMetaPath);

    this.activeDb = db;
    this.cachedKeyBuffer = keyBuffer;

    return { db, keyHex };
  }

  /**
   * Unlocks an existing encrypted vault database using the master password.
   */
  public async unlock(
    masterPassword: string,
    customPath?: string
  ): Promise<{ db: IVaultDatabase; keyHex: string }> {
    const targetDbPath = customPath || getVaultDbPath();
    const targetMetaPath = customPath
      ? path.join(path.dirname(customPath), 'vault_meta.json')
      : getVaultMetaPath();

    this.currentDbPath = targetDbPath;

    if (!fs.existsSync(targetDbPath)) {
      throw new Error(`Vault database file not found at ${targetDbPath}`);
    }

    const meta = readVaultMetadata(targetMetaPath);
    if (!meta || !meta.kdf?.saltHex) {
      throw new Error('Vault metadata is missing or corrupted.');
    }

    const salt = Buffer.from(meta.kdf.saltHex, 'hex');
    const keyBuffer = deriveEncryptionKey(masterPassword, salt);
    const keyHex = keyBuffer.toString('hex');

    let db: SqliteVaultDatabase | null = null;
    try {
      db = openEncryptedDatabase(targetDbPath, keyHex);
      const isConnectionValid = db.verifyConnection();

      if (!isConnectionValid) {
        db.close();
        wipeBuffer(keyBuffer);
        throw new Error('Invalid master password. Decryption failed.');
      }
    } catch (err: unknown) {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore close errors on invalid db
        }
      }
      wipeBuffer(keyBuffer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to unlock vault: ${msg}`);
    }

    // Update last unlocked timestamp
    meta.lastUnlockedAt = new Date().toISOString();
    writeVaultMetadata(meta, targetMetaPath);

    this.activeDb = db;
    this.cachedKeyBuffer = keyBuffer;

    return { db, keyHex };
  }

  /**
   * Locks the vault: closes database connection and zeroes out in-memory key material.
   */
  public lock(): void {
    if (this.activeDb) {
      this.activeDb.close();
      this.activeDb = null;
    }
    if (this.cachedKeyBuffer) {
      wipeBuffer(this.cachedKeyBuffer);
      this.cachedKeyBuffer = null;
    }
  }
}
