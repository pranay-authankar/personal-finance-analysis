/**
 * Types and interfaces for the FamilyVault CSV-to-SQLite Migration Engine.
 */

export type ValidationSeverity = 'ERROR' | 'WARNING';

export interface ValidationError {
  table: string;
  rowNumber: number;
  id: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
  value?: unknown;
}

export interface TableReconciliation {
  sourceRows: number;
  validRows: number;
  rejectedRows: number;
  warningsCount: number;
  importedRows: number;
  status: 'MATCHED' | 'DISCREPANCY' | 'REJECTED';
}

export interface FinancialCategoryReconciliation {
  category: string;
  sourceTotal: number;
  importedTotal: number;
  difference: number;
  status: 'RECONCILED' | 'MISMATCH';
}

export interface MigrationReport {
  success: boolean;
  mode: 'DRY_RUN' | 'LIVE';
  sourceDataDir: string;
  targetDbPath: string;
  tables: Record<string, TableReconciliation>;
  financials: Record<string, FinancialCategoryReconciliation>;
  errors: ValidationError[];
  warnings: ValidationError[];
  missingDocuments: string[];
  unreferencedUploads: string[];
  foreignKeyViolations: number;
  backupCreated: boolean;
  backupPath?: string;
  message: string;
  durationMs: number;
}

export interface MigrationOptions {
  sourceDataDir: string;
  sourceUploadsDir?: string;
  targetDbPath?: string;
  targetMetaPath?: string;
  masterPassword: string;
  dryRun?: boolean; // Defaults to true for safety
  allowMissingAttachments?: boolean;
  skipBackup?: boolean;
}

export interface ParsedCsvDataset {
  family_members: Record<string, string>[];
  assets: Record<string, string>[];
  fds: Record<string, string>[];
  post_office: Record<string, string>[];
  bullions: Record<string, string>[];
  properties: Record<string, string>[];
  rents: Record<string, string>[];
  asset_sales: Record<string, string>[];
  payments: Record<string, string>[];
  documents: Record<string, string>[];
  contributions: Record<string, string>[];
  fileHashes: Record<string, string>;
}
