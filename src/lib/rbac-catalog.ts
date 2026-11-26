import { ROLE_PERMISSIONS } from '@/lib/permissions';

/** Built-in role names - reserved; orgs cannot create/rename into these. */
export const SYSTEM_ROLE_NAMES = ['ADMIN', 'MANAGER', 'USER'] as const;

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

export const PERMISSION_GROUPS: { id: string; label: string; permissions: string[] }[] = [
  {
    id: 'password',
    label: 'Passwords',
    permissions: [
      'PASSWORD:CREATE',
      'PASSWORD:READ',
      'PASSWORD:UPDATE',
      'PASSWORD:DELETE',
      'PASSWORD:SHARE',
    ],
  },
  {
    id: 'user',
    label: 'Users',
    permissions: [
      'USER:CREATE',
      'USER:READ',
      'USER:UPDATE',
      'USER:DELETE',
      'USER:DEACTIVATE',
    ],
  },
  {
    id: 'team',
    label: 'Teams',
    permissions: [
      'TEAM:CREATE',
      'TEAM:READ',
      'TEAM:UPDATE',
      'TEAM:DELETE',
      'TEAM:MANAGE_MEMBERS',
    ],
  },
  {
    id: 'reports',
    label: 'Reports & analytics',
    permissions: ['REPORT:VIEW', 'REPORT:GENERATE', 'REPORT:EXPORT', 'ANALYTICS:VIEW'],
  },
  {
    id: 'security',
    label: 'Security & audit',
    permissions: ['AUDIT:READ', 'SECURITY:SCAN', 'SECURITY:VIEW'],
  },
  {
    id: 'admin',
    label: 'Administration',
    permissions: [
      'ROLE:MANAGE',
      'PERMISSION:MANAGE',
      'SETTINGS:MANAGE',
      'BACKUP:MANAGE',
      'SSO:CONFIGURE',
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    permissions: ['COMPLIANCE:VIEW', 'COMPLIANCE:MANAGE'],
  },
];

/** Permissions org admins may put on custom roles (same ceiling as ADMIN). */
export const ORG_ROLE_PERMISSIONS: string[] = ROLE_PERMISSIONS.ADMIN;

export const ROLE_TEMPLATES: Record<string, string[]> = {
  blank: [],
  USER: [...ROLE_PERMISSIONS.USER],
  MANAGER: [...ROLE_PERMISSIONS.MANAGER],
  ADMIN: [...ROLE_PERMISSIONS.ADMIN],
};

export function isReservedRoleName(name: string): boolean {
  return SYSTEM_ROLE_NAMES.includes(name.trim().toUpperCase() as SystemRoleName);
}

export function parseRolePermissions(raw: string | null | undefined, roleName?: string): string[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((p) => typeof p === 'string');
    } catch {
      /* fall through */
    }
  }
  if (roleName && ROLE_PERMISSIONS[roleName]) return [...ROLE_PERMISSIONS[roleName]];
  return [];
}

/** Drop unknown / over-ceiling permissions. Returns cleaned list or error. */
export function sanitizeOrgRolePermissions(input: unknown): { ok: true; permissions: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'permissions must be an array' };
  }
  const allowed = new Set(ORG_ROLE_PERMISSIONS);
  const next: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') {
      return { ok: false, error: 'permissions must be strings' };
    }
    if (!allowed.has(item)) {
      return { ok: false, error: `Permission not allowed for org roles: ${item}` };
    }
    if (!next.includes(item)) next.push(item);
  }
  return { ok: true, permissions: next };
}
