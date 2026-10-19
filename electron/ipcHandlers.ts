import { ipcMain, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  SqliteStorageEngine
} from '../server/storage/sqliteAdapter.ts';
import { EncryptedDocumentStorage } from '../server/storage/documentStorage.ts';
import { VaultBackupRestoreManager } from '../server/storage/backupManager.ts';
import {
  getVaultDbPath,
  getVaultMetaPath,
  getVaultAttachmentsDir,
  getVaultBackupsDir
} from '../server/config.ts';
import { ALL_TABLE_NAMES, type TableName } from '../server/storage/schema.ts';
import { SyncServer } from '../server/sync/syncServer.ts';
import { SyncClient } from '../server/sync/syncClient.ts';
import { TABLE_ORDER, type SyncRole, type ConflictResolutionPolicy } from '../server/sync/syncProtocol.ts';
import type {
  VaultStatus,
  VaultAllRecords,
  StoredAttachmentResult,
  DecryptedAttachmentResult
} from './types.ts';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const VALID_TABLES = new Set<string>(ALL_TABLE_NAMES);

export class VaultIpcController {
  private engine: SqliteStorageEngine;
  private docStorage: EncryptedDocumentStorage;
  private backupManager: VaultBackupRestoreManager;
  private syncServer: SyncServer;
  private syncClient: SyncClient;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.engine = new SqliteStorageEngine();
    this.docStorage = new EncryptedDocumentStorage(getVaultAttachmentsDir());
    this.backupManager = new VaultBackupRestoreManager(
      getVaultDbPath(),
      getVaultAttachmentsDir(),
      getVaultBackupsDir()
    );
    this.syncServer = new SyncServer({
      vaultDir: path.dirname(getVaultDbPath()),
      getVaultRecords: async () => this.handleDirectLoadAll(),
      applyVaultRecords: async (records) => this.handleDirectApplyVaultRecords(records),
      createBackup: async () => {
        const keyBuffer = this.engine.getKeyBuffer();
        if (!keyBuffer) throw new Error('Vault is locked. Cannot create pre-sync backup.');
        const destDir = getVaultBackupsDir();
        fs.mkdirSync(destDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const targetFile = path.join(destDir, `pre_sync_backup_${timestamp}.fvault`);
        await this.backupManager.createBackup(targetFile, keyBuffer);
        return { success: true, backupPath: targetFile };
      }
    });
    this.syncClient = new SyncClient();
  }


  public setWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (this.engine.isUnlocked()) {
      this.inactivityTimer = setTimeout(() => {
        this.handleAutoLock();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }

  private handleAutoLock(): void {
    if (this.engine.isUnlocked()) {
      this.engine.lock();
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('vault:locked');
      }
    }
  }

  public registerHandlers(): void {
    // 1. Vault Status
    ipcMain.handle('vault:get-status', async (): Promise<VaultStatus> => {
      this.resetInactivityTimer();
      const metaPath = getVaultMetaPath();
      const dbPath = getVaultDbPath();
      const isConfigured = fs.existsSync(metaPath) && fs.existsSync(dbPath);
      const isUnlocked = this.engine.isUnlocked();

      return {
        isConfigured,
        isUnlocked,
        vaultDbPath: dbPath,
        isElectron: true
      };
    });

    // 2. Setup (First-run vault creation)
    ipcMain.handle('vault:setup', async (_event, masterPassword: string) => {
      try {
        if (!masterPassword || masterPassword.length < 8) {
          return { success: false, error: 'Master password must be at least 8 characters long.' };
        }
        await this.engine.initialize(masterPassword);
        this.resetInactivityTimer();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to initialize vault.';
        return { success: false, error: msg };
      }
    });

    // 3. Unlock Vault
    ipcMain.handle('vault:unlock', async (_event, masterPassword: string) => {
      try {
        if (!masterPassword) {
          return { success: false, error: 'Master password is required.' };
        }
        await this.engine.unlock(masterPassword);
        this.resetInactivityTimer();
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to unlock vault.';
        return { success: false, error: msg };
      }
    });

    // 4. Lock Vault
    ipcMain.handle('vault:lock', async () => {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
        this.inactivityTimer = null;
      }
      this.engine.lock();
      return { success: true };
    });

    // 5. Load All 11 Domain Tables
    ipcMain.handle('vault:load-all', async (): Promise<VaultAllRecords> => {
      this.resetInactivityTimer();
      const db = this.engine.getDb();
      if (!db || !this.engine.isUnlocked()) {
        throw new Error('Vault is locked. Cannot load data.');
      }

      return {
        familyMembers: db.prepare('SELECT * FROM family_members ORDER BY created_at ASC').all() as any[],
        assets: db.prepare('SELECT * FROM assets ORDER BY created_at ASC').all() as any[],
        fds: db.prepare('SELECT * FROM fds').all() as any[],
        postOffice: db.prepare('SELECT * FROM post_office').all() as any[],
        bullions: db.prepare('SELECT * FROM bullions').all() as any[],
        properties: db.prepare('SELECT * FROM properties').all() as any[],
        rents: db.prepare('SELECT * FROM rents').all() as any[],
        assetSales: db.prepare('SELECT * FROM asset_sales').all() as any[],
        payments: db.prepare('SELECT * FROM payments').all() as any[],
        documents: db.prepare('SELECT * FROM documents').all() as any[],
        contributions: db.prepare('SELECT * FROM contributions').all() as any[]
      };
    });

    // 6. Save Table (Transactional UPSERT with sync of deleted rows)
    ipcMain.handle('vault:save-table', async (_event, tableName: string, rows: Record<string, unknown>[]) => {
      this.resetInactivityTimer();
      const db = this.engine.getDb();
      if (!db || !this.engine.isUnlocked()) {
        return { success: false, error: 'Vault is locked.' };
      }

      if (!VALID_TABLES.has(tableName) || tableName === '_migration_ledger') {
        return { success: false, error: `Invalid table: ${tableName}` };
      }

      try {
        db.transaction(() => {
          this.syncTableRows(db, tableName as TableName, rows || []);
        });
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database error while saving table.';
        return { success: false, error: msg };
      }
    });

    // 7. Clear All
    ipcMain.handle('vault:clear-all', async () => {
      this.resetInactivityTimer();
      const db = this.engine.getDb();
      if (!db || !this.engine.isUnlocked()) {
        return { success: false, error: 'Vault is locked.' };
      }

      try {
        db.transaction(() => {
          // Delete child tables first to respect foreign keys
          const tablesToClear = [
            'documents',
            'contributions',
            'payments',
            'rents',
            'asset_sales',
            'fds',
            'post_office',
            'bullions',
            'properties',
            'assets',
            'family_members'
          ];
          for (const tbl of tablesToClear) {
            db.exec(`DELETE FROM ${tbl};`);
          }
        });

        // Clear encrypted document attachments
        const attachmentsDir = getVaultAttachmentsDir();
        if (fs.existsSync(attachmentsDir)) {
          const files = fs.readdirSync(attachmentsDir);
          for (const f of files) {
            if (f.endsWith('.enc')) {
              try {
                fs.unlinkSync(path.join(attachmentsDir, f));
              } catch {
                // ignore
              }
            }
          }
        }

        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to clear vault data.';
        return { success: false, error: msg };
      }
    });

    // 8. Upload Encrypted Attachment
    ipcMain.handle('vault:upload-attachment', async (_event, payload: { originalFilename: string; mimeType: string; dataBase64: string }): Promise<StoredAttachmentResult> => {
      this.resetInactivityTimer();
      const keyBuffer = this.engine.getKeyBuffer();
      if (!keyBuffer || !this.engine.isUnlocked()) {
        throw new Error('Vault is locked. Cannot encrypt attachment.');
      }

      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let base64Clean = payload.dataBase64 || '';
      if (base64Clean.includes(';base64,')) {
        base64Clean = base64Clean.split(';base64,')[1];
      }
      const fileBuffer = Buffer.from(base64Clean, 'base64');
      const safeOrigName = (payload.originalFilename || 'attachment.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');

      const meta = await this.docStorage.storeEncryptedDocument(
        docId,
        safeOrigName,
        fileBuffer,
        keyBuffer,
        payload.mimeType || 'application/octet-stream'
      );

      return {
        d_id: docId,
        d_link: `vault://attachments/${meta.storedFileName}`,
        d_name: safeOrigName,
        originalFilename: safeOrigName,
        fileSizeBytes: meta.fileSizeBytes,
        mimeType: meta.mimeType
      };
    });

    // 9. Read Decrypted Attachment
    ipcMain.handle('vault:read-attachment', async (_event, docPathOrLink: string): Promise<DecryptedAttachmentResult> => {
      this.resetInactivityTimer();
      const keyBuffer = this.engine.getKeyBuffer();
      if (!keyBuffer || !this.engine.isUnlocked()) {
        throw new Error('Vault is locked. Cannot decrypt attachment.');
      }

      // Parse stored file name
      const cleanPath = docPathOrLink.replace(/^vault:\/\/attachments\//, '').replace(/^\/uploads\//, '');
      const docId = path.basename(cleanPath, path.extname(cleanPath));

      const doc = await this.docStorage.retrieveEncryptedDocument(docId, keyBuffer);
      const dataUrl = `data:${doc.mimeType};base64,${doc.content.toString('base64')}`;

      return {
        dataUrl,
        originalName: doc.originalName,
        mimeType: doc.mimeType
      };
    });

    // 10. Delete Attachment
    ipcMain.handle('vault:delete-attachment', async (_event, docPathOrLink: string) => {
      this.resetInactivityTimer();
      const cleanPath = docPathOrLink.replace(/^vault:\/\/attachments\//, '').replace(/^\/uploads\//, '');
      const docId = path.basename(cleanPath, path.extname(cleanPath));
      const success = await this.docStorage.deleteEncryptedDocument(docId);
      return { success };
    });

    // 11. Create Backup
    ipcMain.handle('vault:create-backup', async (_event, customDestPath?: string) => {
      this.resetInactivityTimer();
      const db = this.engine.getDb();
      const keyBuffer = this.engine.getKeyBuffer();
      if (!db || !keyBuffer || !this.engine.isUnlocked()) {
        throw new Error('Vault is locked. Cannot create backup.');
      }

      const destDir = customDestPath ? path.dirname(customDestPath) : getVaultBackupsDir();
      fs.mkdirSync(destDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const targetFile = customDestPath || path.join(destDir, `familyvault_backup_${timestamp}.fvault`);

      const manifest = await this.backupManager.createBackup(targetFile, keyBuffer);
      return {
        success: true,
        backupPath: targetFile,
        timestamp: manifest.createdAt
      };
    });

    // 12. Restore Backup
    ipcMain.handle('vault:restore-backup', async (_event, backupPath: string, password: string) => {
      try {
        const targetDbPath = getVaultDbPath();
        const targetMetaPath = getVaultMetaPath();

        // Lock existing connection before replacing file
        this.engine.lock();

        const success = await this.backupManager.restoreBackup(
          backupPath,
          password,
          targetDbPath,
          targetMetaPath
        );

        // Unlock restored database
        if (success) {
          await this.engine.unlock(password);
          this.resetInactivityTimer();
        }

        return { success };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to restore backup.';
        return { success: false, error: msg };
      }
    });

    // 13. Heartbeat
    ipcMain.handle('vault:heartbeat', async () => {
      this.resetInactivityTimer();
    });

    // 14. Sync: Start Host Session
    ipcMain.handle('vault:sync:start-host', async (_event, role?: SyncRole) => {
      this.resetInactivityTimer();
      if (!this.engine.isUnlocked()) {
        throw new Error('Vault must be unlocked to start sync session.');
      }
      return this.syncServer.startSession(role);
    });

    // 15. Sync: Stop Host Session
    ipcMain.handle('vault:sync:stop-host', async () => {
      this.resetInactivityTimer();
      await this.syncServer.stopSession();
    });

    // 16. Sync: Get Local IPs
    ipcMain.handle('vault:sync:get-local-ips', async () => {
      return this.syncServer.getLocalIps();
    });

    // 17. Sync: Connect Client
    ipcMain.handle('vault:sync:connect-client', async (_event, options: { hostIp: string; port: number; pin: string }) => {
      this.resetInactivityTimer();
      if (!this.engine.isUnlocked()) {
        throw new Error('Vault must be unlocked to connect for sync.');
      }
      return this.syncClient.connectAndPair({
        hostIp: options.hostIp,
        port: options.port,
        pin: options.pin,
        peerDevice: {
          deviceId: `peer_${os.hostname()}`,
          deviceName: os.hostname(),
          platform: (process.platform === 'win32' ? 'windows' : 'other'),
          appVersion: '1.0.0'
        }
      });
    });

    // 18. Sync: Preview Sync Plan
    ipcMain.handle('vault:sync:preview-sync', async () => {
      this.resetInactivityTimer();
      const localVault = this.handleDirectLoadAll();
      return this.syncClient.previewSync(localVault);
    });

    // 19. Sync: Execute Sync Transfer
    ipcMain.handle('vault:sync:execute-sync', async (_event, options: { policy: ConflictResolutionPolicy; manualChoices?: Record<string, 'local' | 'remote'> }) => {
      this.resetInactivityTimer();
      const localVault = this.handleDirectLoadAll();
      return this.syncClient.pushSync(localVault, options.policy, options.manualChoices);
    });

    // 20. Sync: Get Paired Devices
    ipcMain.handle('vault:sync:get-paired-devices', async () => {
      return this.syncServer.getPairedDevices();
    });

    // 21. Sync: Revoke Device
    ipcMain.handle('vault:sync:revoke-device', async (_event, deviceId: string) => {
      return this.syncServer.revokeDevice(deviceId);
    });
  }

  public handleDirectLoadAll(): VaultAllRecords {
    const db = this.engine.getDb();
    if (!db || !this.engine.isUnlocked()) {
      throw new Error('Vault is locked. Cannot load data.');
    }

    return {
      familyMembers: db.prepare('SELECT * FROM family_members ORDER BY created_at ASC').all() as any[],
      assets: db.prepare('SELECT * FROM assets ORDER BY created_at ASC').all() as any[],
      fds: db.prepare('SELECT * FROM fds').all() as any[],
      postOffice: db.prepare('SELECT * FROM post_office').all() as any[],
      bullions: db.prepare('SELECT * FROM bullions').all() as any[],
      properties: db.prepare('SELECT * FROM properties').all() as any[],
      rents: db.prepare('SELECT * FROM rents').all() as any[],
      assetSales: db.prepare('SELECT * FROM asset_sales').all() as any[],
      payments: db.prepare('SELECT * FROM payments').all() as any[],
      documents: db.prepare('SELECT * FROM documents').all() as any[],
      contributions: db.prepare('SELECT * FROM contributions').all() as any[]
    };
  }

  public handleDirectApplyVaultRecords(records: VaultAllRecords): { success: boolean; error?: string } {
    const db = this.engine.getDb();
    if (!db || !this.engine.isUnlocked()) {
      return { success: false, error: 'Vault is locked.' };
    }

    const tableDbMap: Record<string, TableName> = {
      familyMembers: 'family_members',
      assets: 'assets',
      fds: 'fds',
      postOffice: 'post_office',
      bullions: 'bullions',
      properties: 'properties',
      rents: 'rents',
      assetSales: 'asset_sales',
      payments: 'payments',
      documents: 'documents',
      contributions: 'contributions'
    };

    try {
      const txn = db.transaction(() => {
        for (const tableKey of TABLE_ORDER) {
          const dbTable = tableDbMap[tableKey];
          const rows = records[tableKey];
          if (rows && Array.isArray(rows)) {
            this.syncTableRows(db, dbTable, rows as Record<string, unknown>[]);
          }
        }
        const fkCheck = db.pragma('foreign_key_check');
        if (Array.isArray(fkCheck) && fkCheck.length > 0) {
          throw new Error(`Foreign key constraint failure: ${JSON.stringify(fkCheck)}`);
        }
      });
      txn();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply synced records';
      return { success: false, error: msg };
    }
  }


  /**
   * Helper that reconciles an incoming table array with SQLite.
   * Performs UPSERT and deletes removed IDs.
   */
  private syncTableRows(db: any, table: TableName, rows: Record<string, unknown>[]): void {
    const pkMap: Record<string, string> = {
      family_members: 'member_id',
      assets: 'a_id',
      fds: 'fd_id',
      post_office: 'po_id',
      bullions: 'b_id',
      properties: 'p_id',
      rents: 'r_id',
      asset_sales: 'sale_id',
      payments: 'payment_id',
      documents: 'd_id',
      contributions: 'contribution_id'
    };

    const pk = pkMap[table];
    if (!pk) return;

    // Collect new IDs
    const newIds = new Set<string>();
    for (const r of rows) {
      const idVal = String(r[pk] || '').trim();
      if (idVal) newIds.add(idVal);
    }

    // Get existing IDs from database
    const existingRows = db.prepare(`SELECT ${pk} as id FROM ${table}`).all() as { id: string }[];
    const idsToDelete = existingRows.filter((row) => !newIds.has(row.id)).map((row) => row.id);

    // Delete removed records
    if (idsToDelete.length > 0) {
      const delStmt = db.prepare(`DELETE FROM ${table} WHERE ${pk} = ?`);
      for (const id of idsToDelete) {
        delStmt.run(id);
      }
    }

    // Insert or update all incoming rows
    if (table === 'family_members') {
      const stmt = db.prepare(`
        INSERT INTO family_members (member_id, member_name, role, avatar)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(member_id) DO UPDATE SET
          member_name = excluded.member_name,
          role = excluded.role,
          avatar = excluded.avatar,
          updated_at = CURRENT_TIMESTAMP
      `);
      for (const r of rows) {
        stmt.run(
          String(r.member_id || '').trim(),
          String(r.member_name || '').trim(),
          String(r.role || 'Family Member').trim(),
          String(r.avatar || '🧑').trim()
        );
      }
    } else if (table === 'assets') {
      const stmt = db.prepare(`
        INSERT INTO assets (a_id, member_id, asset_type, asset_name, asset_status)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(a_id) DO UPDATE SET
          member_id = excluded.member_id,
          asset_type = excluded.asset_type,
          asset_name = excluded.asset_name,
          asset_status = excluded.asset_status,
          updated_at = CURRENT_TIMESTAMP
      `);
      for (const r of rows) {
        stmt.run(
          String(r.a_id || '').trim(),
          String(r.member_id || '').trim(),
          String(r.asset_type || 'FD').trim().toUpperCase(),
          String(r.asset_name || '').trim(),
          String(r.asset_status || 'ACTIVE').trim().toUpperCase()
        );
      }
    } else if (table === 'fds') {
      const stmt = db.prepare(`
        INSERT INTO fds (fd_id, a_id, bank_name, acc_number, principal, interest_rate, start_date, maturity_date, actual_end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fd_id) DO UPDATE SET
          a_id = excluded.a_id,
          bank_name = excluded.bank_name,
          acc_number = excluded.acc_number,
          principal = excluded.principal,
          interest_rate = excluded.interest_rate,
          start_date = excluded.start_date,
          maturity_date = excluded.maturity_date,
          actual_end_date = excluded.actual_end_date
      `);
      for (const r of rows) {
        stmt.run(
          String(r.fd_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.bank_name || '').trim(),
          String(r.acc_number || '').trim(),
          Number(r.principal) || 0,
          Number(r.interest_rate) || 0,
          String(r.start_date || '').trim(),
          String(r.maturity_date || '').trim(),
          String(r.actual_end_date || '').trim()
        );
      }
    } else if (table === 'post_office') {
      const stmt = db.prepare(`
        INSERT INTO post_office (po_id, a_id, scheme_name, account_number, principal, interest_rate, start_date, maturity_date, actual_end_date, scheme_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(po_id) DO UPDATE SET
          a_id = excluded.a_id,
          scheme_name = excluded.scheme_name,
          account_number = excluded.account_number,
          principal = excluded.principal,
          interest_rate = excluded.interest_rate,
          start_date = excluded.start_date,
          maturity_date = excluded.maturity_date,
          actual_end_date = excluded.actual_end_date,
          scheme_status = excluded.scheme_status
      `);
      for (const r of rows) {
        stmt.run(
          String(r.po_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.scheme_name || '').trim(),
          String(r.account_number || '').trim(),
          r.principal === '' || r.principal === null || r.principal === undefined ? null : Number(r.principal),
          Number(r.interest_rate) || 0,
          String(r.start_date || '').trim(),
          String(r.maturity_date || '').trim(),
          String(r.actual_end_date || '').trim(),
          String(r.scheme_status || 'ACTIVE').trim().toUpperCase()
        );
      }
    } else if (table === 'bullions') {
      const stmt = db.prepare(`
        INSERT INTO bullions (b_id, a_id, b_type, purchase_value, purchase_date, b_status, payment_due_date, weight, weight_unit, purchase_rate, weight_display)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(b_id) DO UPDATE SET
          a_id = excluded.a_id,
          b_type = excluded.b_type,
          purchase_value = excluded.purchase_value,
          purchase_date = excluded.purchase_date,
          b_status = excluded.b_status,
          payment_due_date = excluded.payment_due_date,
          weight = excluded.weight,
          weight_unit = excluded.weight_unit,
          purchase_rate = excluded.purchase_rate,
          weight_display = excluded.weight_display
      `);
      for (const r of rows) {
        stmt.run(
          String(r.b_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.b_type || '').trim().toUpperCase(),
          Number(r.purchase_value) || 0,
          String(r.purchase_date || '').trim(),
          String(r.b_status || 'HELD').trim().toUpperCase(),
          String(r.payment_due_date || '').trim(),
          Number(r.weight) || 0,
          String(r.weight_unit || '').trim(),
          Number(r.purchase_rate) || 0,
          String(r.weight_display || '').trim()
        );
      }
    } else if (table === 'properties') {
      const stmt = db.prepare(`
        INSERT INTO properties (p_id, a_id, p_type, name, location, area_sqft, area_unit, purchase_price, party_name, party_contact, purchase_date, p_notes, payment_deadline)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(p_id) DO UPDATE SET
          a_id = excluded.a_id,
          p_type = excluded.p_type,
          name = excluded.name,
          location = excluded.location,
          area_sqft = excluded.area_sqft,
          area_unit = excluded.area_unit,
          purchase_price = excluded.purchase_price,
          party_name = excluded.party_name,
          party_contact = excluded.party_contact,
          purchase_date = excluded.purchase_date,
          p_notes = excluded.p_notes,
          payment_deadline = excluded.payment_deadline
      `);
      for (const r of rows) {
        stmt.run(
          String(r.p_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.p_type || 'LAND').trim(),
          String(r.name || '').trim(),
          String(r.location || '').trim(),
          String(r.area_sqft || '').trim(),
          String(r.area_unit || '').trim(),
          Number(r.purchase_price) || 0,
          String(r.party_name || '').trim(),
          String(r.party_contact || '').trim(),
          String(r.purchase_date || '').trim(),
          String(r.p_notes || '').trim(),
          String(r.payment_deadline || '').trim()
        );
      }
    } else if (table === 'rents') {
      const stmt = db.prepare(`
        INSERT INTO rents (r_id, p_id, tenant_name, tenant_contact, rent_amount, rent_start_date, rent_end_date, next_rent_due, r_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(r_id) DO UPDATE SET
          p_id = excluded.p_id,
          tenant_name = excluded.tenant_name,
          tenant_contact = excluded.tenant_contact,
          rent_amount = excluded.rent_amount,
          rent_start_date = excluded.rent_start_date,
          rent_end_date = excluded.rent_end_date,
          next_rent_due = excluded.next_rent_due,
          r_notes = excluded.r_notes
      `);
      for (const r of rows) {
        stmt.run(
          String(r.r_id || '').trim(),
          String(r.p_id || '').trim(),
          String(r.tenant_name || '').trim(),
          String(r.tenant_contact || '').trim(),
          Number(r.rent_amount) || 0,
          String(r.rent_start_date || '').trim(),
          String(r.rent_end_date || '').trim(),
          String(r.next_rent_due || '').trim(),
          String(r.r_notes || '').trim()
        );
      }
    } else if (table === 'asset_sales') {
      const stmt = db.prepare(`
        INSERT INTO asset_sales (sale_id, a_id, buyer_name, buyer_contact, sale_price, sale_date, payment_due_date, sale_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sale_id) DO UPDATE SET
          a_id = excluded.a_id,
          buyer_name = excluded.buyer_name,
          buyer_contact = excluded.buyer_contact,
          sale_price = excluded.sale_price,
          sale_date = excluded.sale_date,
          payment_due_date = excluded.payment_due_date,
          sale_notes = excluded.sale_notes
      `);
      for (const r of rows) {
        stmt.run(
          String(r.sale_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.buyer_name || '').trim(),
          String(r.buyer_contact || '').trim(),
          Number(r.sale_price) || 0,
          String(r.sale_date || '').trim(),
          String(r.payment_due_date || '').trim(),
          String(r.sale_notes || '').trim()
        );
      }
    } else if (table === 'payments') {
      const stmt = db.prepare(`
        INSERT INTO payments (payment_id, a_id, payment_type, payment_context, amount, payment_date, due_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(payment_id) DO UPDATE SET
          a_id = excluded.a_id,
          payment_type = excluded.payment_type,
          payment_context = excluded.payment_context,
          amount = excluded.amount,
          payment_date = excluded.payment_date,
          due_date = excluded.due_date,
          status = excluded.status,
          notes = excluded.notes
      `);
      for (const r of rows) {
        stmt.run(
          String(r.payment_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.payment_type || 'PURCHASE').trim().toUpperCase(),
          String(r.payment_context || 'PURCHASE').trim().toUpperCase(),
          Number(r.amount) || 0,
          String(r.payment_date || '').trim(),
          String(r.due_date || '').trim(),
          String(r.status || 'PENDING').trim().toUpperCase(),
          String(r.notes || '').trim()
        );
      }
    } else if (table === 'documents') {
      const stmt = db.prepare(`
        INSERT INTO documents (d_id, a_id, r_id, d_category, d_name, d_link)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(d_id) DO UPDATE SET
          a_id = excluded.a_id,
          r_id = excluded.r_id,
          d_category = excluded.d_category,
          d_name = excluded.d_name,
          d_link = excluded.d_link
      `);
      for (const r of rows) {
        stmt.run(
          String(r.d_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.r_id || '').trim(),
          String(r.d_category || 'OTHER').trim().toUpperCase(),
          String(r.d_name || '').trim(),
          String(r.d_link || '').trim()
        );
      }
    } else if (table === 'contributions') {
      const stmt = db.prepare(`
        INSERT INTO contributions (contribution_id, a_id, contribution_type, amount, frequency, due_date, payment_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(contribution_id) DO UPDATE SET
          a_id = excluded.a_id,
          contribution_type = excluded.contribution_type,
          amount = excluded.amount,
          frequency = excluded.frequency,
          due_date = excluded.due_date,
          payment_date = excluded.payment_date,
          status = excluded.status,
          notes = excluded.notes
      `);
      for (const r of rows) {
        stmt.run(
          String(r.contribution_id || '').trim(),
          String(r.a_id || '').trim(),
          String(r.contribution_type || 'RD_DEPOSIT').trim().toUpperCase(),
          Number(r.amount) || 0,
          String(r.frequency || 'MONTHLY').trim().toUpperCase(),
          String(r.due_date || '').trim(),
          String(r.payment_date || '').trim(),
          String(r.status || 'PENDING').trim().toUpperCase(),
          String(r.notes || '').trim()
        );
      }
    }
  }
}
