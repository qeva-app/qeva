import prisma from '@/lib/db';
import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { clientIpFromHeaders, getClientIp } from '@/lib/request-ip';

interface AuditLogParams {
  userId?: string | null;
  action: string;
  resource: string;
  details?: Record<string, any>;
  req?: NextRequest;
  ipAddress?: string;
  userAgent?: string;
}

function requestMeta(req?: NextRequest): { ipAddress?: string; userAgent?: string } {
  if (req) {
    const ip = getClientIp(req);
    return {
      ipAddress: ip !== 'unknown' ? ip : undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    };
  }
  try {
    const h = headers();
    const ip = clientIpFromHeaders(h);
    return {
      ipAddress: ip !== 'unknown' ? ip : undefined,
      userAgent: h.get('user-agent') || undefined,
    };
  } catch {
    return {};
  }
}

export async function logAudit({
  userId,
  action,
  resource,
  details,
  req,
  ipAddress,
  userAgent,
}: AuditLogParams) {
  try {
    const meta = requestMeta(req);
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        resource,
        details: details ? JSON.stringify(details) : undefined,
        ipAddress: ipAddress ?? meta.ipAddress,
        userAgent: userAgent ?? meta.userAgent,
      },
    });
  } catch (error) {
    // Audit logging should never break the operation it's logging
    console.error('Audit log failed:', error);
  }
}

/** Dedupe chatty clients (extension host polls). Use globalThis so Next chunks share one Map. */
const recentAuditKeys: Map<string, number> = (() => {
  const g = globalThis as typeof globalThis & { __qevaAuditOnce?: Map<string, number> };
  if (!g.__qevaAuditOnce) g.__qevaAuditOnce = new Map();
  return g.__qevaAuditOnce;
})();

export function auditOncePer(key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = recentAuditKeys.get(key) || 0;
  if (now - last < windowMs) return false;
  recentAuditKeys.set(key, now);
  // shortcut: in-memory only; multi-instance needs shared store
  if (recentAuditKeys.size > 2000) {
    for (const [k, t] of recentAuditKeys) {
      if (now - t > windowMs) recentAuditKeys.delete(k);
    }
  }
  return true;
}

// Standard action constants
export const AuditActions = {
  // Auth
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTERED: 'USER_REGISTERED',
  USER_VERIFIED: 'USER_VERIFIED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',

  // Passwords
  PASSWORD_CREATED: 'PASSWORD_CREATED',
  PASSWORD_UPDATED: 'PASSWORD_UPDATED',
  PASSWORD_DELETED: 'PASSWORD_DELETED',
  PASSWORD_VIEWED: 'PASSWORD_VIEWED',

  // Encryption
  ENCRYPTION_SETUP: 'ENCRYPTION_SETUP',
  ENCRYPTION_UNLOCKED: 'ENCRYPTION_UNLOCKED',
  ENCRYPTION_LOCKED: 'ENCRYPTION_LOCKED',
  ENCRYPTION_DISABLED: 'ENCRYPTION_DISABLED',
  ENCRYPTION_RECOVERED: 'ENCRYPTION_RECOVERED',

  // Teams
  TEAM_CREATED: 'TEAM_CREATED',
  TEAM_UPDATED: 'TEAM_UPDATED',
  TEAM_DELETED: 'TEAM_DELETED',
  TEAM_MEMBER_ADDED: 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED: 'TEAM_MEMBER_REMOVED',

  // Users (admin)
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ROLE_ASSIGNED: 'USER_ROLE_ASSIGNED',
  USER_PASSWORD_RESET_ADMIN: 'USER_PASSWORD_RESET_ADMIN',

  // Settings
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  PROFILE_PASSWORD_CHANGED: 'PROFILE_PASSWORD_CHANGED',
  MFA_SETUP: 'MFA_SETUP',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_VERIFIED: 'MFA_VERIFIED',

  // Roles & Permissions
  ROLE_CREATED: 'ROLE_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  ROLE_DELETED: 'ROLE_DELETED',

  // SSO
  SSO_CONFIG_CREATED: 'SSO_CONFIG_CREATED',
  SSO_CONFIG_UPDATED: 'SSO_CONFIG_UPDATED',
  SSO_CONFIG_DELETED: 'SSO_CONFIG_DELETED',
  SSO_CONFIG_ACTIVATED: 'SSO_CONFIG_ACTIVATED',

  // Backup
  BACKUP_CONFIG_CREATED: 'BACKUP_CONFIG_CREATED',
  BACKUP_EXECUTED: 'BACKUP_EXECUTED',
  BACKUP_RESTORED: 'BACKUP_RESTORED',
  BACKUP_CLEANUP: 'BACKUP_CLEANUP',

  // Tokens
  TOKEN_CREATED: 'TOKEN_CREATED',
  TOKEN_DELETED: 'TOKEN_DELETED',

  // Import
  PASSWORDS_IMPORTED: 'PASSWORDS_IMPORTED',

  // Reports
  REPORT_GENERATED: 'REPORT_GENERATED',
  REPORT_DELETED: 'REPORT_DELETED',

  // Audit
  AUDIT_PURGED: 'AUDIT_PURGED',

  // Security
  SECURITY_SCAN_TRIGGERED: 'SECURITY_SCAN_TRIGGERED',

  // Database
  DB_CONNECTION_CREATED: 'DB_CONNECTION_CREATED',
  DB_CONNECTION_DELETED: 'DB_CONNECTION_DELETED',
  DB_CONNECTION_TESTED: 'DB_CONNECTION_TESTED',

  // Categories
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_DELETED: 'CATEGORY_DELETED',

  // Services
  SERVICE_CREATED: 'SERVICE_CREATED',
  SERVICE_UPDATED: 'SERVICE_UPDATED',
  SERVICE_DELETED: 'SERVICE_DELETED',
  SERVICE_TEST: 'SERVICE_TEST',

  // Shares
  SHARED_LINK_CREATED: 'SHARED_LINK_CREATED',
  SHARED_LINK_REVOKED: 'SHARED_LINK_REVOKED',
  SHARED_LINK_VIEWED: 'SHARED_LINK_VIEWED',

  // Emergency access
  EMERGENCY_ACCESS_GRANTED: 'EMERGENCY_ACCESS_GRANTED',
  EMERGENCY_ACCESS_REQUESTED: 'EMERGENCY_ACCESS_REQUESTED',
  EMERGENCY_ACCESS_ACTIVATED: 'EMERGENCY_ACCESS_ACTIVATED',
  EMERGENCY_ACCESS_REVOKED: 'EMERGENCY_ACCESS_REVOKED',
  EMERGENCY_ACCESS_REJECTED: 'EMERGENCY_ACCESS_REJECTED',

  // Workflows
  WORKFLOW_CREATED: 'WORKFLOW_CREATED',
  WORKFLOW_UPDATED: 'WORKFLOW_UPDATED',
  WORKFLOW_DELETED: 'WORKFLOW_DELETED',
  WORKFLOW_ASSIGNED: 'WORKFLOW_ASSIGNED',

  // Organizations
  ORG_CREATED: 'ORG_CREATED',
  ORG_APPROVED: 'ORG_APPROVED',
  ORG_UPDATED: 'ORG_UPDATED',
  ORG_DEACTIVATED: 'ORG_DEACTIVATED',
} as const;
