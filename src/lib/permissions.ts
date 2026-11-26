import prisma from './db';
import cache from './cache';

const PERMISSION_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Role permission definitions
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'PASSWORD:CREATE', 'PASSWORD:READ', 'PASSWORD:UPDATE', 'PASSWORD:DELETE', 'PASSWORD:SHARE',
    'USER:CREATE', 'USER:READ', 'USER:UPDATE', 'USER:DELETE', 'USER:DEACTIVATE',
    'TEAM:CREATE', 'TEAM:READ', 'TEAM:UPDATE', 'TEAM:DELETE', 'TEAM:MANAGE_MEMBERS',
    'REPORT:VIEW', 'REPORT:GENERATE', 'REPORT:EXPORT',
    'ANALYTICS:VIEW',
    'AUDIT:READ',
    'SECURITY:SCAN', 'SECURITY:VIEW',
    'ROLE:MANAGE', 'PERMISSION:MANAGE', 'SETTINGS:MANAGE', 'BACKUP:MANAGE', 'SSO:CONFIGURE',
    'COMPLIANCE:VIEW', 'COMPLIANCE:MANAGE',
  ],
  MANAGER: [
    'PASSWORD:CREATE', 'PASSWORD:READ', 'PASSWORD:UPDATE', 'PASSWORD:DELETE', 'PASSWORD:SHARE',
    'USER:READ', 'USER:UPDATE',
    'TEAM:CREATE', 'TEAM:READ', 'TEAM:UPDATE', 'TEAM:DELETE', 'TEAM:MANAGE_MEMBERS',
    'REPORT:VIEW', 'REPORT:GENERATE', 'REPORT:EXPORT',
    'ANALYTICS:VIEW',
    'AUDIT:READ',
    'SECURITY:VIEW',
    'COMPLIANCE:VIEW',
  ],
  USER: [
    'PASSWORD:CREATE', 'PASSWORD:READ', 'PASSWORD:UPDATE', 'PASSWORD:DELETE',
    'TEAM:READ', 'TEAM:MANAGE_MEMBERS',
    'ANALYTICS:VIEW',
  ],
};

export class RBACService {
  static async hasPermissionDB(userId: string, permission: string): Promise<boolean> {
    const cacheKey = `perm:${userId}:${permission}`;
    const cached = cache.get<boolean>(cacheKey);
    if (cached !== null) return cached;

    // Check direct permission overrides first
    const directPerm = await prisma.userPermission.findFirst({
      where: {
        userId,
        permission: { name: permission },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (directPerm) {
      cache.set(cacheKey, directPerm.granted, PERMISSION_CACHE_TTL);
      return directPerm.granted;
    }

    // Check role-based permissions
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: { userId, isActive: true },
      include: { role: true },
    });

    for (const assignment of userRoles) {
      if (!assignment.role.isActive) continue;
      if (assignment.expiresAt && assignment.expiresAt < new Date()) continue;

      const rolePerms = assignment.role.permissions
        ? JSON.parse(assignment.role.permissions)
        : ROLE_PERMISSIONS[assignment.role.name] || [];

      if (rolePerms.includes(permission)) {
        cache.set(cacheKey, true, PERMISSION_CACHE_TTL);
        return true;
      }
    }

    cache.set(cacheKey, false, PERMISSION_CACHE_TTL);
    return false;
  }
}

export async function hasPermissionDB(userId: string, permission: string): Promise<boolean> {
  return RBACService.hasPermissionDB(userId, permission);
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const cacheKey = `user_perms:${userId}`;
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  const permissions: Set<string> = new Set();

  // Get role-based permissions
  const userRoles = await prisma.userRoleAssignment.findMany({
    where: { userId, isActive: true },
    include: { role: true },
  });

  for (const assignment of userRoles) {
    if (!assignment.role.isActive) continue;
    if (assignment.expiresAt && assignment.expiresAt < new Date()) continue;

    const rolePerms = assignment.role.permissions
      ? JSON.parse(assignment.role.permissions)
      : ROLE_PERMISSIONS[assignment.role.name] || [];

    rolePerms.forEach((p: string) => permissions.add(p));
  }

  // Get direct permission overrides
  const directPerms = await prisma.userPermission.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { permission: true },
  });

  for (const dp of directPerms) {
    if (dp.granted) {
      permissions.add(dp.permission.name);
    } else {
      permissions.delete(dp.permission.name);
    }
  }

  const result = Array.from(permissions);
  cache.set(cacheKey, result, PERMISSION_CACHE_TTL);
  return result;
}

export async function getUserRole(userId: string): Promise<string> {
  const assignment = await prisma.userRoleAssignment.findFirst({
    where: { userId, isPrimary: true, isActive: true },
    include: { role: true },
  });
  return assignment?.role?.name || 'USER';
}
