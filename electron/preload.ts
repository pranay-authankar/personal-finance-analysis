import { contextBridge, ipcRenderer } from 'electron';
import type { VaultApiBridge } from './types.ts';

const bridge: VaultApiBridge = {
  getStatus: () => ipcRenderer.invoke('vault:get-status'),
  createVault: (masterPassword: string) => ipcRenderer.invoke('vault:setup', masterPassword),
  unlockVault: (masterPassword: string) => ipcRenderer.invoke('vault:unlock', masterPassword),
  lockVault: () => ipcRenderer.invoke('vault:lock'),
  loadAll: () => ipcRenderer.invoke('vault:load-all'),
  saveTable: (tableName: string, rows: unknown[]) => ipcRenderer.invoke('vault:save-table', tableName, rows),
  clearAll: () => ipcRenderer.invoke('vault:clear-all'),
  uploadAttachment: (payload) => ipcRenderer.invoke('vault:upload-attachment', payload),
  readAttachment: (docPathOrLink: string) => ipcRenderer.invoke('vault:read-attachment', docPathOrLink),
  deleteAttachment: (docPathOrLink: string) => ipcRenderer.invoke('vault:delete-attachment', docPathOrLink),
  createBackup: (customDestPath?: string) => ipcRenderer.invoke('vault:create-backup', customDestPath),
  restoreBackup: (backupPath: string, password: string) => ipcRenderer.invoke('vault:restore-backup', backupPath, password),
  heartbeat: () => ipcRenderer.invoke('vault:heartbeat'),
  onLocked: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('vault:locked', handler);
    return () => {
      ipcRenderer.removeListener('vault:locked', handler);
    };
  }
};

contextBridge.exposeInMainWorld('vaultApi', bridge);
