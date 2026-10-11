import crypto from 'node:crypto';
import fs from 'node:fs';
import type { Database } from 'better-sqlite3-multiple-ciphers';
import {
  deriveEncryptionKey,
  readVaultMetadata,
  writeVaultMetadata,
  wipeBuffer,
  type VaultMetadata
} from './crypto.ts';
import {
  openEncryptedDatabase,
  initializeSchema,
  verifyDatabaseConnection
} from './db.ts';
import { getVaultDbPath, getVaultMetaPath, CRYPTO_CONFIG } from './config.ts';

export interface VaultStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  dbPath: string;
  metaPath: string;
}

class VaultManager {
  private static instance: VaultManager;
  private activeDb: Database | null = null;
  private activeKeyBuffer: Buffer | null = null;
  private sessionToken: string | null = null;

  public static getInstance(): VaultManager {
    if (!VaultManager.instance) {
      VaultManager.instance = new VaultManager();
    }
    return VaultManager.instance;
  }

  public getStatus(): VaultStatus {
    const meta = readVaultMetadata();
    const dbPath = getVaultDbPath();
    const isInitialized = Boolean(meta && fs.existsSync(dbPath));
    const isUnlocked = Boolean(this.activeDb !== null && this.sessionToken !== null);

    return {
      isInitialized,
      isUnlocked,
      dbPath,
      metaPath: getVaultMetaPath()
    };
  }

  public getDatabase(): Database {
    if (!this.activeDb) {
      throw new Error('Vault is locked. Unlock with Master Password first.');
    }
    return this.activeDb;
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public validateSession(token?: string | null): boolean {
    if (!token || !this.sessionToken) return false;
    // Constant time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(this.sessionToken)
    );
  }

  public initialize(masterPassword: string): { success: boolean; sessionToken: string } {
    if (this.getStatus().isInitialized) {
      throw new Error('Vault is already initialized. Use unlock instead.');
    }

    const salt = crypto.randomBytes(CRYPTO_CONFIG.SALT_BYTES);
    const keyBuffer = deriveEncryptionKey(masterPassword, salt);
    const keyHex = keyBuffer.toString('hex');

    const dbPath = getVaultDbPath();
    const db = openEncryptedDatabase(dbPath, keyHex);
    initializeSchema(db);

    const meta: VaultMetadata = {
      version: 1,
      kdf: {
        algorithm: 'PBKDF2',
        iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
        saltHex: salt.toString('hex'),
        digest: CRYPTO_CONFIG.DIGEST
      },
      cipher: CRYPTO_CONFIG.CIPHER,
      createdAt: new Date().toISOString(),
      lastUnlockedAt: new Date().toISOString()
    };
    writeVaultMetadata(meta);

    this.activeDb = db;
    this.activeKeyBuffer = keyBuffer;
    this.sessionToken = crypto.randomBytes(32).toString('hex');

    return { success: true, sessionToken: this.sessionToken };
  }

  public unlock(masterPassword: string): { success: boolean; sessionToken: string } {
    const meta = readVaultMetadata();
    if (!meta) {
      throw new Error('Vault has not been initialized yet.');
    }

    // Close any previous session if open
    this.lock();

    const salt = Buffer.from(meta.kdf.saltHex, 'hex');
    const keyBuffer = deriveEncryptionKey(masterPassword, salt);
    const keyHex = keyBuffer.toString('hex');

    try {
      const db = openEncryptedDatabase(getVaultDbPath(), keyHex);
      const isValid = verifyDatabaseConnection(db);
      if (!isValid) {
        db.close();
        wipeBuffer(keyBuffer);
        throw new Error('Incorrect Master Password. Decryption failed.');
      }

      this.activeDb = db;
      this.activeKeyBuffer = keyBuffer;
      this.sessionToken = crypto.randomBytes(32).toString('hex');

      meta.lastUnlockedAt = new Date().toISOString();
      writeVaultMetadata(meta);

      return { success: true, sessionToken: this.sessionToken };
    } catch (err: unknown) {
      wipeBuffer(keyBuffer);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('file is not a database') || errMsg.includes('encrypted')) {
        throw new Error('Incorrect Master Password. Access denied.');
      }
      throw err;
    }
  }

  public lock(): void {
    if (this.activeDb) {
      try {
        this.activeDb.close();
      } catch {
        // ignore close error
      }
      this.activeDb = null;
    }

    if (this.activeKeyBuffer) {
      wipeBuffer(this.activeKeyBuffer);
      this.activeKeyBuffer = null;
    }

    this.sessionToken = null;
  }
}

export const vaultManager = VaultManager.getInstance();
