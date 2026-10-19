import type {
  FamilyMemberRecord,
  AssetRecord,
  FdRecord,
  PostOfficeRecord,
  BullionRecord,
  PropertyRecord,
  RentRecord,
  AssetSaleRecord,
  PaymentRecord,
  DocumentRecord,
  ContributionRecord
} from '../src/types/index.ts';

export interface VaultStatus {
  isConfigured: boolean;
  isUnlocked: boolean;
  vaultDbPath: string;
  isElectron: boolean;
}

export interface VaultAllRecords {
  familyMembers: FamilyMemberRecord[];
  assets: AssetRecord[];
  fds: FdRecord[];
  postOffice: PostOfficeRecord[];
  bullions: BullionRecord[];
  properties: PropertyRecord[];
  rents: RentRecord[];
  assetSales: AssetSaleRecord[];
  payments: PaymentRecord[];
  documents: DocumentRecord[];
  contributions: ContributionRecord[];
}

export interface StoredAttachmentResult {
  d_id: string;
  d_link: string;
  d_name: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface DecryptedAttachmentResult {
  dataUrl: string;
  originalName: string;
  mimeType: string;
}

export type SyncRole = 'host_sender' | 'host_receiver' | 'bidirectional';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: 'windows' | 'android' | 'browser' | 'other';
  appVersion: string;
}

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  platform: string;
  pairedAt: string;
  lastSyncAt?: string;
  isRevoked: boolean;
}

export interface HostSessionInfo {
  sessionId: string;
  hostDevice: DeviceInfo;
  port: number;
  hostIps: string[];
  publicKeyHex: string;
  expiresAt: number;
}

export interface ConflictingRecord {
  table: keyof VaultAllRecords;
  id: string;
  localRecord: Record<string, unknown>;
  remoteRecord: Record<string, unknown>;
  differingFields: string[];
}

export interface SyncPlan {
  totalInserts: number;
  totalIdentical: number;
  totalConflicts: number;
  missingAttachments: string[];
  inserts: Partial<Record<keyof VaultAllRecords, Record<string, unknown>[]>>;
  conflicts: ConflictingRecord[];
}

export type ConflictResolutionPolicy = 'keep_local' | 'use_remote' | 'selective';

export interface SyncExecutionResult {
  success: boolean;
  backupPath?: string;
  recordsInserted: number;
  recordsUpdated: number;
  recordsPreserved: number;
  attachmentsTransferred: number;
  error?: string;
}

export interface VaultSyncBridge {
  startHost(role?: SyncRole): Promise<{ sessionInfo: HostSessionInfo; pin: string }>;
  stopHost(): Promise<void>;
  getLocalIps(): Promise<string[]>;
  connectClient(options: { hostIp: string; port: number; pin: string }): Promise<{ hostDevice: DeviceInfo }>;
  previewSync(localVault: VaultAllRecords): Promise<SyncPlan>;
  executeSync(options: { policy: ConflictResolutionPolicy; manualChoices?: Record<string, 'local' | 'remote'> }): Promise<SyncExecutionResult>;
  getPairedDevices(): Promise<PairedDevice[]>;
  revokeDevice(deviceId: string): Promise<boolean>;
}

export interface VaultApiBridge {
  getStatus(): Promise<VaultStatus>;
  createVault(masterPassword: string): Promise<{ success: boolean; error?: string }>;
  unlockVault(masterPassword: string): Promise<{ success: boolean; error?: string }>;
  lockVault(): Promise<{ success: boolean }>;
  loadAll(): Promise<VaultAllRecords>;
  saveTable(tableName: string, rows: unknown[]): Promise<{ success: boolean; error?: string }>;
  clearAll(): Promise<{ success: boolean; error?: string }>;
  uploadAttachment(payload: { originalFilename: string; mimeType: string; dataBase64: string }): Promise<StoredAttachmentResult>;
  readAttachment(docPathOrLink: string): Promise<DecryptedAttachmentResult>;
  deleteAttachment(docPathOrLink: string): Promise<{ success: boolean; error?: string }>;
  createBackup(customDestPath?: string): Promise<{ success: boolean; backupPath: string; timestamp: string }>;
  restoreBackup(backupPath: string, password: string): Promise<{ success: boolean; error?: string }>;
  heartbeat(): Promise<void>;
  onLocked(callback: () => void): () => void;
  sync?: VaultSyncBridge;
}
