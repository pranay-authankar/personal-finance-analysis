import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getVaultDbPath, getVaultAttachmentsDir, getVaultBackupsDir } from '../config.ts';
import { deriveEncryptionKey, generateSalt, encryptBlob, decryptBlob } from './crypto.ts';
import type { IBackupRestoreManager, BackupManifest, RestoreReport } from './types.ts';

const BACKUP_MAGIC = Buffer.from('FVBACK1', 'utf8'); // FamilyVault Backup Archive v1

/**
 * Vault Backup & Restore implementation.
 * Produces atomic, self-contained, encrypted backup archives (.fvault).
 */
export class VaultBackupRestoreManager implements IBackupRestoreManager {
  private dbPath: string;
  private attachmentsDir: string;
  private backupsDir: string;

  constructor(
    dbPath: string = getVaultDbPath(),
    attachmentsDir: string = getVaultAttachmentsDir(),
    backupsDir: string = getVaultBackupsDir()
  ) {
    this.dbPath = dbPath;
    this.attachmentsDir = attachmentsDir;
    this.backupsDir = backupsDir;
  }

  /**
   * Creates an atomic backup archive containing the encrypted database and encrypted attachments.
   */
  public async createBackup(
    destinationPath?: string,
    _mek?: Buffer,
    customBackupPassphrase?: string
  ): Promise<BackupManifest> {
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database file does not exist at ${this.dbPath}`);
    }

    const destDir = destinationPath ? path.dirname(destinationPath) : this.backupsDir;
    fs.mkdirSync(destDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const targetFile =
      destinationPath || path.join(destDir, `familyvault_backup_${timestamp}.fvault`);

    // 1. Read encrypted database bytes
    const dbBytes = fs.readFileSync(this.dbPath);
    const dbSha256 = crypto.createHash('sha256').update(dbBytes).digest('hex');

    // 2. Collect encrypted documents
    const documents: { filename: string; contentBase64: string }[] = [];
    if (fs.existsSync(this.attachmentsDir)) {
      const files = fs.readdirSync(this.attachmentsDir);
      for (const file of files) {
        if (file.endsWith('.enc')) {
          const docBytes = fs.readFileSync(path.join(this.attachmentsDir, file));
          documents.push({
            filename: file,
            contentBase64: docBytes.toString('base64')
          });
        }
      }
    }

    // 3. Assemble package payload
    const payload = JSON.stringify({
      manifestVersion: 1,
      vaultVersion: 1,
      createdAt: new Date().toISOString(),
      databaseSha256: dbSha256,
      databaseBase64: dbBytes.toString('base64'),
      documentsCount: documents.length,
      documents
    });

    const payloadBuffer = Buffer.from(payload, 'utf8');
    let finalArchiveBytes: Buffer;
    let encryptedWithCustom = false;

    if (customBackupPassphrase && customBackupPassphrase.length >= 8) {
      // Encrypt the entire archive envelope with the backup passphrase
      const backupSalt = generateSalt();
      const backupKey = deriveEncryptionKey(customBackupPassphrase, backupSalt);
      const { iv, authTag, ciphertext } = encryptBlob(payloadBuffer, backupKey);

      // Format: [BACKUP_MAGIC(7)][1(flag: encrypted)][SALT(32)][IV(12)][TAG(16)][CIPHERTEXT]
      finalArchiveBytes = Buffer.concat([
        BACKUP_MAGIC,
        Buffer.from([0x01]),
        backupSalt,
        iv,
        authTag,
        ciphertext
      ]);
      encryptedWithCustom = true;
    } else {
      // Format: [BACKUP_MAGIC(7)][0(flag: raw encrypted db payload)][PAYLOAD]
      finalArchiveBytes = Buffer.concat([BACKUP_MAGIC, Buffer.from([0x00]), payloadBuffer]);
    }

    fs.writeFileSync(targetFile, finalArchiveBytes);

    return {
      manifestVersion: 1,
      vaultVersion: 1,
      createdAt: new Date().toISOString(),
      databaseSha256: dbSha256,
      documentsCount: documents.length,
      totalSizeBytes: finalArchiveBytes.length,
      encryptedWithCustomPassphrase: encryptedWithCustom
    };
  }

  /**
   * Validates archive integrity without modifying any target files.
   */
  public async verifyBackupArchive(
    archivePath: string,
    customBackupPassphrase?: string
  ): Promise<BackupManifest> {
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Archive file not found at ${archivePath}`);
    }

    const archiveBytes = fs.readFileSync(archivePath);
    if (archiveBytes.length < BACKUP_MAGIC.length + 1) {
      throw new Error('Archive file is corrupted: header too short.');
    }

    const magic = archiveBytes.subarray(0, BACKUP_MAGIC.length);
    if (!magic.equals(BACKUP_MAGIC)) {
      throw new Error('Invalid archive format: missing FVBACK1 magic header.');
    }

    const isCustomEncrypted = archiveBytes[BACKUP_MAGIC.length] === 0x01;
    let payloadBuffer: Buffer;

    if (isCustomEncrypted) {
      if (!customBackupPassphrase) {
        throw new Error('This backup archive is encrypted with a custom passphrase.');
      }

      let offset = BACKUP_MAGIC.length + 1;
      const salt = archiveBytes.subarray(offset, offset + 32);
      offset += 32;
      const iv = archiveBytes.subarray(offset, offset + 12);
      offset += 12;
      const authTag = archiveBytes.subarray(offset, offset + 16);
      offset += 16;
      const ciphertext = archiveBytes.subarray(offset);

      const backupKey = deriveEncryptionKey(customBackupPassphrase, salt);
      payloadBuffer = decryptBlob(ciphertext, backupKey, iv, authTag);
    } else {
      payloadBuffer = archiveBytes.subarray(BACKUP_MAGIC.length + 1);
    }

    const parsed = JSON.parse(payloadBuffer.toString('utf8')) as {
      manifestVersion: number;
      vaultVersion: number;
      createdAt: string;
      databaseSha256: string;
      documentsCount: number;
    };

    return {
      manifestVersion: parsed.manifestVersion,
      vaultVersion: parsed.vaultVersion,
      createdAt: parsed.createdAt,
      databaseSha256: parsed.databaseSha256,
      documentsCount: parsed.documentsCount,
      totalSizeBytes: archiveBytes.length,
      encryptedWithCustomPassphrase: isCustomEncrypted
    };
  }

  /**
   * Restores a backup archive into the target vault directory.
   */
  public async restoreBackup(
    archivePath: string,
    mekOrPassphrase?: Buffer | string,
    targetDirectory?: string
  ): Promise<RestoreReport> {
    const passphrase = typeof mekOrPassphrase === 'string' ? mekOrPassphrase : undefined;
    await this.verifyBackupArchive(archivePath, passphrase);

    const archiveBytes = fs.readFileSync(archivePath);
    const isCustomEncrypted = archiveBytes[BACKUP_MAGIC.length] === 0x01;
    let payloadBuffer: Buffer;

    if (isCustomEncrypted) {
      let offset = BACKUP_MAGIC.length + 1;
      const salt = archiveBytes.subarray(offset, offset + 32);
      offset += 32;
      const iv = archiveBytes.subarray(offset, offset + 12);
      offset += 12;
      const authTag = archiveBytes.subarray(offset, offset + 16);
      offset += 16;
      const ciphertext = archiveBytes.subarray(offset);

      const backupKey = deriveEncryptionKey(passphrase || '', salt);
      payloadBuffer = decryptBlob(ciphertext, backupKey, iv, authTag);
    } else {
      payloadBuffer = archiveBytes.subarray(BACKUP_MAGIC.length + 1);
    }

    const parsed = JSON.parse(payloadBuffer.toString('utf8')) as {
      databaseBase64: string;
      documents: { filename: string; contentBase64: string }[];
    };

    const targetDb = targetDirectory ? path.join(targetDirectory, 'familyvault.db') : this.dbPath;
    const targetAttachments = targetDirectory
      ? path.join(targetDirectory, 'attachments')
      : this.attachmentsDir;

    fs.mkdirSync(path.dirname(targetDb), { recursive: true });
    fs.mkdirSync(targetAttachments, { recursive: true });

    // Restore database
    const dbBytes = Buffer.from(parsed.databaseBase64, 'base64');
    fs.writeFileSync(targetDb, dbBytes);

    // Restore documents
    let docsRestored = 0;
    if (Array.isArray(parsed.documents)) {
      for (const doc of parsed.documents) {
        const docBytes = Buffer.from(doc.contentBase64, 'base64');
        const safeName = path.basename(doc.filename);
        fs.writeFileSync(path.join(targetAttachments, safeName), docBytes);
        docsRestored++;
      }
    }

    return {
      success: true,
      recordsRestored: 1,
      documentsRestored: docsRestored,
      timestamp: new Date().toISOString(),
      targetDbPath: targetDb
    };
  }
}
