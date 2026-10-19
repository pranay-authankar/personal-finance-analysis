import { registerPlugin, Capacitor } from '@capacitor/core';
import type {
  VaultApiBridge,
  VaultStatus,
  StoredAttachmentResult,
  DecryptedAttachmentResult,
  VaultAllRecords
} from '../../electron/types';

interface FamilyVaultNativePlugin {
  getStatus(): Promise<{ isConfigured: boolean; isUnlocked: boolean; vaultPath?: string }>;
  createVault(options: { masterPassword: string }): Promise<{ success: boolean; error?: string }>;
  unlockVault(options: { masterPassword: string }): Promise<{ success: boolean; error?: string }>;
  lockVault(): Promise<{ success: boolean }>;
  loadAll(): Promise<Record<string, unknown[]>>;
  saveTable(options: { tableName: string; records: Record<string, unknown>[] }): Promise<{ success: boolean }>;
  clearAll(): Promise<{ success: boolean }>;
  uploadAttachment(options: { originalFilename: string; mimeType: string; dataBase64: string }): Promise<{ d_link: string; originalFilename: string; mimeType: string; size: number }>;
  readAttachment(options: { attachmentPath: string }): Promise<{ originalFilename: string; mimeType: string; dataBase64: string }>;
  deleteAttachment(options: { attachmentPath: string }): Promise<{ success: boolean }>;
  createBackup(): Promise<{ backupPath: string; filename: string; size: number; timestamp: string }>;
  restoreBackup(options: { backupData: string }): Promise<{ success: boolean; restoredAt: string }>;
  heartbeat(): Promise<{ active: boolean }>;
  addListener(eventName: 'vaultLocked', listenerFunc: () => void): Promise<{ remove: () => void }>;
}

const FamilyVaultNative = registerPlugin<FamilyVaultNativePlugin>('FamilyVaultNative');

/**
 * Initializes the Android native bridge if running inside Capacitor Android native environment.
 * Sets window.vaultApi so all existing React components, auth, and database services
 * work with zero code modifications.
 */
export function initAndroidVaultBridge(): void {
  if (typeof window === 'undefined') return;

  // Do not override if Electron preload has already injected window.vaultApi
  if (window.vaultApi) return;

  if (Capacitor.isNativePlatform()) {
    const bridge: VaultApiBridge = {
      getStatus: async (): Promise<VaultStatus> => {
        const res = await FamilyVaultNative.getStatus();
        return {
          isConfigured: res.isConfigured,
          isUnlocked: res.isUnlocked,
          vaultDbPath: res.vaultPath || 'internal://vault/familyvault.fvault',
          isElectron: false
        };
      },
      createVault: async (masterPassword: string) => {
        return FamilyVaultNative.createVault({ masterPassword });
      },
      unlockVault: async (masterPassword: string) => {
        return FamilyVaultNative.unlockVault({ masterPassword });
      },
      lockVault: async () => {
        return FamilyVaultNative.lockVault();
      },
      loadAll: async (): Promise<VaultAllRecords> => {
        const raw = await FamilyVaultNative.loadAll();
        return raw as unknown as VaultAllRecords;
      },
      saveTable: async (tableName: string, records: unknown[]) => {
        return FamilyVaultNative.saveTable({
          tableName,
          records: records as Record<string, unknown>[]
        });
      },
      clearAll: async () => {
        return FamilyVaultNative.clearAll();
      },
      uploadAttachment: async (payload): Promise<StoredAttachmentResult> => {
        const res = await FamilyVaultNative.uploadAttachment(payload);
        const filename = res.originalFilename || 'document';
        return {
          d_id: `doc_${Date.now()}`,
          d_name: filename,
          d_link: res.d_link,
          originalFilename: filename,
          fileSizeBytes: res.size,
          mimeType: res.mimeType
        };
      },
      readAttachment: async (docPathOrLink: string): Promise<DecryptedAttachmentResult> => {
        const res = await FamilyVaultNative.readAttachment({ attachmentPath: docPathOrLink });
        return {
          dataUrl: res.dataBase64,
          originalName: res.originalFilename,
          mimeType: res.mimeType
        };
      },
      deleteAttachment: async (docPathOrLink: string) => {
        return FamilyVaultNative.deleteAttachment({ attachmentPath: docPathOrLink });
      },
      createBackup: async () => {
        const res = await FamilyVaultNative.createBackup();
        return {
          success: true,
          backupPath: res.backupPath,
          timestamp: res.timestamp
        };
      },
      restoreBackup: async (backupData: string) => {
        const res = await FamilyVaultNative.restoreBackup({ backupData });
        return { success: res.success };
      },
      onLocked: (callback: () => void): (() => void) => {
        let listenerHandle: { remove: () => void } | null = null;
        FamilyVaultNative.addListener('vaultLocked', callback).then((h) => {
          listenerHandle = h;
        });
        return () => {
          if (listenerHandle) {
            listenerHandle.remove();
          }
        };
      },
      heartbeat: async (): Promise<void> => {
        await FamilyVaultNative.heartbeat();
      }
    };

    window.vaultApi = bridge;
  }
}
