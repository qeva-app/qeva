/** Community stub — real directory sync lives in qeva-enterprise overlay. */
import {
  DEFAULT_FIELD_MAPPING,
  DIRECTORY_MAPPABLE_FIELDS,
  type DirectoryFieldMapping,
} from '@/lib/directory-sync-shared';

export { DEFAULT_FIELD_MAPPING, DIRECTORY_MAPPABLE_FIELDS };
export type { DirectoryFieldMapping };

export function parseFieldMapping(raw: string | null | undefined): DirectoryFieldMapping {
  if (!raw) return { ...DEFAULT_FIELD_MAPPING };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FIELD_MAPPING, ...parsed };
  } catch {
    return { ...DEFAULT_FIELD_MAPPING };
  }
}

export type DirectorySyncPublic = {
  id: string;
  provider: string;
  tenantId: string;
  clientId: string;
  hasClientSecret: boolean;
  fieldMapping: DirectoryFieldMapping;
  syncManagers: boolean;
  createMissingUsers: boolean;
  deactivateMissing: boolean;
  syncGroups: boolean;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncSummary: string | null;
};

export function toPublicConfig(row: {
  id: string;
  provider: string;
  tenantId: string;
  clientId: string;
  clientSecretEnc: string;
  fieldMapping: string | null;
  syncManagers: boolean;
  createMissingUsers: boolean;
  deactivateMissing?: boolean;
  syncGroups?: boolean;
  isActive: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncSummary: string | null;
}): DirectorySyncPublic {
  return {
    id: row.id,
    provider: row.provider,
    tenantId: row.tenantId,
    clientId: row.clientId,
    hasClientSecret: !!row.clientSecretEnc,
    fieldMapping: parseFieldMapping(row.fieldMapping),
    syncManagers: row.syncManagers,
    createMissingUsers: row.createMissingUsers,
    deactivateMissing: !!row.deactivateMissing,
    syncGroups: !!row.syncGroups,
    isActive: row.isActive,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncSummary: row.lastSyncSummary,
  };
}

export function encryptClientSecret(secret: string): string {
  return secret;
}

export function decryptClientSecret(enc: string): string {
  return enc;
}

export type SyncSummary = {
  scanned: number;
  matched: number;
  updated: number;
  managersSet: number;
  created: number;
  skipped: number;
  deactivated: number;
  teamsLinked: number;
  errors: string[];
};

export async function runMicrosoftGraphSync(_organizationId: string) {
  return { ok: false as const, error: 'Directory sync requires Qeva Enterprise' };
}

export async function testMicrosoftGraphConnection(_organizationId: string) {
  return { ok: false as const, error: 'Directory sync requires Qeva Enterprise' };
}

