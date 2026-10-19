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
} from '../src/types';

export interface VaultStatus {
  isConfigured: boolean;
  isUnlocked: boolean;
  vaultDbPath: string;
  isElectron: true;
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
}
