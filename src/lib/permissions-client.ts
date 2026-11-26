// Client-safe permission checking — no DB access

import { ROLE_PERMISSIONS } from './permissions';

export function hasPermission(role: string, permission: string): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;
  return rolePerms.includes(permission);
}

export function hasAnyPermission(role: string, permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: string, permissions: string[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function isAdmin(role: string): boolean {
  return role === 'ADMIN';
}

export function isManager(role: string): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}
