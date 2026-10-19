/**
 * FamilyVault Device-to-Device Sync Protocol Definitions and Constants
 */

import type { VaultAllRecords } from '../../electron/types.ts';

export const SYNC_PROTOCOL_VERSION = 1;
export const DEFAULT_SYNC_PORT = 8765;
export const PAIRING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_PIN_ATTEMPTS = 3;

export const TABLE_ORDER: (keyof VaultAllRecords)[] = [
  'familyMembers',
  'assets',
  'fds',
  'postOffice',
  'bullions',
  'properties',
  'rents',
  'assetSales',
  'payments',
  'documents',
  'contributions'
];

export const TABLE_PRIMARY_KEYS: Record<keyof VaultAllRecords, string> = {
  familyMembers: 'member_id',
  assets: 'a_id',
  fds: 'fd_id',
  postOffice: 'po_id',
  bullions: 'b_id',
  properties: 'p_id',
  rents: 'r_id',
  assetSales: 'sale_id',
  payments: 'payment_id',
  documents: 'd_id',
  contributions: 'contribution_id'
};

export type {
  SyncRole,
  DeviceInfo,
  PairedDevice,
  HostSessionInfo,
  ConflictingRecord,
  SyncPlan,
  ConflictResolutionPolicy,
  SyncExecutionResult
} from '../../electron/types.ts';

export interface PairRequest {
  sessionId: string;
  peerDevice: import('../../electron/types.ts').DeviceInfo;
  peerPublicKeyHex: string;
  pinAuthProof: string; // HMAC-SHA256(derivedPinKey, sessionId + peerPublicKeyHex)
}

export interface PairResponse {
  success: boolean;
  hostAuthProof?: string; // HMAC-SHA256(derivedPinKey, sessionId + hostPublicKeyHex)
  error?: string;
}

export interface SyncAttachmentItem {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  ciphertextBase64: string;
}

export interface SyncPayload {
  version: number;
  sourceDeviceId: string;
  timestamp: string;
  tables: VaultAllRecords;
  attachments?: SyncAttachmentItem[];
}
