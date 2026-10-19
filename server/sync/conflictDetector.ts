/**
 * FamilyVault Conflict Detection and Deterministic Merge Engine
 * Detects new entities, identical records, and conflicting fields table-by-table.
 */

import type { VaultAllRecords } from '../../electron/types.ts';
import {
  TABLE_ORDER,
  TABLE_PRIMARY_KEYS,
  type ConflictingRecord,
  type SyncPlan,
  type ConflictResolutionPolicy
} from './syncProtocol.ts';

/**
 * Normalizes a record object to deterministic JSON for hashing and comparison.
 */
export function normalizeRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  const keys = Object.keys(rec).sort();
  for (const k of keys) {
    const val = rec[k];
    if (val === undefined || val === null) {
      clean[k] = null;
    } else if (typeof val === 'number') {
      clean[k] = Number.isFinite(val) ? val : null;
    } else if (typeof val === 'boolean') {
      clean[k] = val;
    } else {
      clean[k] = String(val).trim();
    }
  }
  return clean;
}

/**
 * Computes deep differences between two records.
 */
export function getDifferingFields(
  localRec: Record<string, unknown>,
  remoteRec: Record<string, unknown>
): string[] {
  const normLocal = normalizeRecord(localRec);
  const normRemote = normalizeRecord(remoteRec);
  const allKeys = new Set([...Object.keys(normLocal), ...Object.keys(normRemote)]);
  const diffs: string[] = [];

  for (const key of allKeys) {
    // Ignore internal DB timestamps if present
    if (key === 'created_at' || key === 'updated_at') continue;

    const valL = normLocal[key];
    const valR = normRemote[key];
    if (valL !== valR) {
      diffs.push(key);
    }
  }

  return diffs;
}

/**
 * Analyzes local and remote vaults to construct an atomic SyncPlan.
 */
export function detectConflicts(
  localVault: VaultAllRecords,
  remoteVault: VaultAllRecords
): SyncPlan {
  const inserts: Partial<Record<keyof VaultAllRecords, Record<string, unknown>[]>> = {};
  const conflicts: ConflictingRecord[] = [];
  let insertsCount = 0;
  let identicalCount = 0;

  for (const table of TABLE_ORDER) {
    const pkField = TABLE_PRIMARY_KEYS[table];
    const localList = (localVault[table] || []) as unknown as Record<string, unknown>[];
    const remoteList = (remoteVault[table] || []) as unknown as Record<string, unknown>[];

    const localMap = new Map<string, Record<string, unknown>>();
    for (const rec of localList) {
      const id = String(rec[pkField] || '');
      if (id) {
        localMap.set(id, rec);
      }
    }

    const tableInserts: Record<string, unknown>[] = [];

    for (const remoteRec of remoteList) {
      const id = String(remoteRec[pkField] || '');
      if (!id) continue;

      const localRec = localMap.get(id);
      if (!localRec) {
        tableInserts.push(remoteRec);
        insertsCount++;
      } else {
        const differing = getDifferingFields(localRec, remoteRec);
        if (differing.length === 0) {
          identicalCount++;
        } else {
          conflicts.push({
            table,
            id,
            localRecord: localRec,
            remoteRecord: remoteRec,
            differingFields: differing
          });
        }
      }
    }

    if (tableInserts.length > 0) {
      inserts[table] = tableInserts;
    }
  }

  // Check missing attachment files if document records exist
  const missingAttachments: string[] = [];
  const localDocLinks = new Set(
    ((localVault.documents || []) as unknown as Record<string, unknown>[])
      .map((d: Record<string, unknown>) => String(d.d_link || ''))
      .filter((l: string) => l.startsWith('vault://') || l.endsWith('.enc'))
  );

  const remoteDocs = (remoteVault.documents || []) as unknown as Record<string, unknown>[];
  for (const doc of remoteDocs) {
    const link = String(doc.d_link || '');
    if ((link.startsWith('vault://') || link.endsWith('.enc')) && !localDocLinks.has(link)) {
      missingAttachments.push(link);
    }
  }

  return {
    totalInserts: insertsCount,
    totalIdentical: identicalCount,
    totalConflicts: conflicts.length,
    missingAttachments,
    inserts,
    conflicts
  };
}

/**
 * Resolves conflicts deterministically and generates a merged VaultAllRecords.
 */
export function resolveConflicts(
  localVault: VaultAllRecords,
  remoteVault: VaultAllRecords,
  plan: SyncPlan,
  policy: ConflictResolutionPolicy,
  manualChoices?: Record<string, 'local' | 'remote'>
): {
  merged: VaultAllRecords;
  recordsInserted: number;
  recordsUpdated: number;
  recordsPreserved: number;
} {
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsPreserved = 0;

  // Build conflict decisions lookup
  const conflictDecisions = new Map<string, 'local' | 'remote'>();
  for (const c of plan.conflicts) {
    if (policy === 'keep_local') {
      conflictDecisions.set(`${c.table}:${c.id}`, 'local');
    } else if (policy === 'use_remote') {
      conflictDecisions.set(`${c.table}:${c.id}`, 'remote');
    } else if (policy === 'selective' && manualChoices) {
      const choice = manualChoices[`${c.table}:${c.id}`] || 'local';
      conflictDecisions.set(`${c.table}:${c.id}`, choice);
    } else {
      conflictDecisions.set(`${c.table}:${c.id}`, 'local');
    }
  }

  const merged = {} as VaultAllRecords;

  for (const table of TABLE_ORDER) {
    const pkField = TABLE_PRIMARY_KEYS[table];
    const localList = (localVault[table] || []) as unknown as Record<string, unknown>[];
    const remoteList = (remoteVault[table] || []) as unknown as Record<string, unknown>[];

    const remoteMap = new Map<string, Record<string, unknown>>();
    for (const r of remoteList) {
      const id = String(r[pkField] || '');
      if (id) remoteMap.set(id, r);
    }

    const resultMap = new Map<string, Record<string, unknown>>();

    // 1. Process existing local records
    for (const loc of localList) {
      const id = String(loc[pkField] || '');
      if (!id) continue;

      const remoteRec = remoteMap.get(id);
      if (!remoteRec) {
        // Record only exists locally: preserve
        resultMap.set(id, loc);
        recordsPreserved++;
      } else {
        const differing = getDifferingFields(loc, remoteRec);
        if (differing.length === 0) {
          // Identical
          resultMap.set(id, loc);
          recordsPreserved++;
        } else {
          // Conflict: apply chosen policy
          const decision = conflictDecisions.get(`${table}:${id}`) || 'local';
          if (decision === 'remote') {
            resultMap.set(id, remoteRec);
            recordsUpdated++;
          } else {
            resultMap.set(id, loc);
            recordsPreserved++;
          }
        }
      }
    }

    // 2. Process incoming new records from remote
    for (const rem of remoteList) {
      const id = String(rem[pkField] || '');
      if (!id) continue;

      if (!resultMap.has(id)) {
        resultMap.set(id, rem);
        recordsInserted++;
      }
    }

    merged[table] = Array.from(resultMap.values()) as any;
  }

  return {
    merged,
    recordsInserted,
    recordsUpdated,
    recordsPreserved
  };
}
