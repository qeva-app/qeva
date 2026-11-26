/**
 * Feature access gating based on user account type and organization status.
 * Individual users get personal vault only. Org users get full features
 * depending on org lifecycle (trial, grace, expired).
 * Enterprise-edition product features (SSO, etc.) are AND-ed with src/lib/edition.ts.
 */

import { allowsCompanyAccounts, hasEnterpriseFeature } from '@/lib/edition';

// Public email domains that cannot be used for org signup
export const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'yahoo.co.in',
  'icloud.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'live.com',
  'msn.com',
  'ymail.com',
  'mail.com',
  'zoho.com',
  'tutanota.com',
  'fastmail.com',
  'hey.com',
  'me.com',
  'mac.com',
  'rediffmail.com',
];

export function isPublicEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return PUBLIC_EMAIL_DOMAINS.includes(domain);
}

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

export type OrgStatus = 'PENDING' | 'ACTIVE' | 'TRIAL' | 'GRACE' | 'EXPIRED';

export interface FeatureAccess {
  // Org-only features
  canAccessTeams: boolean;
  canAccessGlobalVault: boolean;
  canAccessServices: boolean;
  canAccessSSO: boolean;
  canAccessReports: boolean;
  canAccessCompliance: boolean;
  canAccessBackup: boolean;
  canAccessEnterprise: boolean;
  canAccessUsers: boolean;
  canAccessRBAC: boolean;
  canAccessAnalytics: boolean;
  canAccessDatabase: boolean;
  canAccessSecurityScan: boolean;
  /** Enterprise edition only - directory IdP sync panel */
  canAccessDirectorySync: boolean;
  /** Enterprise edition only - SIEM export */
  canAccessSiem: boolean;
  /** Enterprise edition only - Slack/Teams alert channels */
  canAccessAlerts: boolean;

  // State flags
  isIndividual: boolean;
  isOrgUser: boolean;
  isReadOnly: boolean;
  isLockedOut: boolean;
  isPendingApproval: boolean;
  orgStatus: OrgStatus | null;
  orgName: string | null;
  orgLogo: string | null;

  // Trial info
  trialDaysRemaining: number | null;
  graceDaysRemaining: number | null;
}

interface UserForAccess {
  accountType?: string | null;
  role?: string;
  /** Platform allowlist - unlocks admin surfaces without requiring org ADMIN role. */
  isSuperAdmin?: boolean;
  organization?: {
    id: string;
    name: string;
    logo?: string | null;
    status: string;
    trialStartDate?: Date | null;
    trialDays?: number;
  } | null;
}

export function getUserFeatureAccess(user: UserForAccess): FeatureAccess {
  // Community Docker / OSS image: personal vault only - ignore any org membership.
  if (!allowsCompanyAccounts()) {
    return {
      canAccessTeams: false,
      canAccessGlobalVault: false,
      canAccessServices: false,
      canAccessSSO: false,
      canAccessReports: false,
      canAccessCompliance: false,
      canAccessBackup: false,
      canAccessEnterprise: false,
      canAccessUsers: false,
      canAccessRBAC: false,
      canAccessAnalytics: false,
      canAccessDatabase: false,
      canAccessSecurityScan: true,
      canAccessDirectorySync: false,
      canAccessSiem: false,
      canAccessAlerts: false,
      isIndividual: true,
      isOrgUser: false,
      isReadOnly: false,
      isLockedOut: false,
      isPendingApproval: false,
      orgStatus: null,
      orgName: null,
      orgLogo: null,
      trialDaysRemaining: null,
      graceDaysRemaining: null,
    };
  }

  const isIndividual = !user.accountType || user.accountType === 'INDIVIDUAL';
  const isOrgUser = user.accountType === 'ORGANIZATION';
  const org = user.organization;
  const orgStatus = (org?.status as OrgStatus) || null;
  const isAdmin = user.role === 'ADMIN' || !!user.isSuperAdmin;

  // Calculate trial/grace state
  let isReadOnly = false;
  let isLockedOut = false;
  let isPendingApproval = false;
  let trialDaysRemaining: number | null = null;
  let graceDaysRemaining: number | null = null;

  if (isOrgUser && org) {
    if (orgStatus === 'PENDING') {
      // Limited, not read-only: personal vault works; org features stay gated
      // until approval (see orgFeatureAvailable below).
      isPendingApproval = true;
    }

    if (orgStatus === 'TRIAL' && org.trialStartDate) {
      const trialEnd = new Date(org.trialStartDate);
      trialEnd.setDate(trialEnd.getDate() + (org.trialDays || 14));
      const now = new Date();
      const msRemaining = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

      if (trialDaysRemaining <= 0) {
        // Trial expired - enter grace period
        isReadOnly = true;
        const graceEnd = new Date(trialEnd);
        graceEnd.setDate(graceEnd.getDate() + 30);
        const graceMs = graceEnd.getTime() - now.getTime();
        graceDaysRemaining = Math.max(0, Math.ceil(graceMs / (1000 * 60 * 60 * 24)));

        if (graceDaysRemaining <= 0) {
          isLockedOut = true;
        }
      }
    }

    if (orgStatus === 'GRACE') {
      isReadOnly = true;
      // Calculate remaining grace from when status was set
      graceDaysRemaining = 30; // Default, should be calculated from status change date
    }

    if (orgStatus === 'EXPIRED') {
      isLockedOut = true;
    }
  }

  // Org features only available to org users with active org
  const orgFeatureAvailable = isOrgUser && !isLockedOut && !isPendingApproval;
  // Super Admin can open RBAC/Users even without an org membership
  const adminSurfaces = (orgFeatureAvailable && isAdmin) || !!user.isSuperAdmin;

  return {
    canAccessTeams: orgFeatureAvailable,
    canAccessGlobalVault: orgFeatureAvailable,
    canAccessServices: orgFeatureAvailable,
    canAccessSSO:
      hasEnterpriseFeature('sso') &&
      ((orgFeatureAvailable && isAdmin) || !!user.isSuperAdmin),
    canAccessReports: adminSurfaces,
    canAccessCompliance: orgFeatureAvailable,
    canAccessBackup: false,
    canAccessEnterprise: adminSurfaces,
    canAccessUsers: adminSurfaces,
    canAccessRBAC: adminSurfaces,
    canAccessAnalytics: adminSurfaces,
    canAccessDatabase: false,
    canAccessSecurityScan: orgFeatureAvailable,
    canAccessDirectorySync:
      hasEnterpriseFeature('directory_sync') && adminSurfaces,
    canAccessSiem: hasEnterpriseFeature('siem') && adminSurfaces,
    canAccessAlerts: hasEnterpriseFeature('alerts') && adminSurfaces,

    isIndividual,
    isOrgUser,
    isReadOnly,
    isLockedOut,
    isPendingApproval,
    orgStatus,
    orgName: org?.name || null,
    orgLogo: org?.logo || null,

    trialDaysRemaining,
    graceDaysRemaining,
  };
}
