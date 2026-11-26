export type ReportPeriod = '7d' | '30d' | '90d' | '1y';
export type ReportFormat = 'CSV' | 'JSON';

export type ReportTypeId =
  | 'audit_export'
  | 'vault_health'
  | 'sharing'
  | 'emergency_access'
  | 'user_posture'
  | 'privileged_access'
  | 'workflows'
  | 'directory_sync'
  | 'sessions'
  | 'compliance_pack'
  | 'teams'
  | 'backup';

export type ReportCatalogItem = {
  id: ReportTypeId;
  label: string;
  description: string;
  category: 'Evidence' | 'Risk' | 'People' | 'Access' | 'Ops';
  requiresOrg: boolean;
};

/** Product catalog — each type answers a question live dashboards do not export. */
export const REPORT_CATALOG: ReportCatalogItem[] = [
  {
    id: 'audit_export',
    label: 'Audit log export',
    description: 'Who did what, when — filterable activity for auditors.',
    category: 'Evidence',
    requiresOrg: true,
  },
  {
    id: 'compliance_pack',
    label: 'Compliance evidence pack',
    description: 'Policy snapshot plus MFA, encryption, and expired-credential exceptions.',
    category: 'Evidence',
    requiresOrg: true,
  },
  {
    id: 'vault_health',
    label: 'Vault health exceptions',
    description: 'Weak, expired, and stale credentials across the org vault.',
    category: 'Risk',
    requiresOrg: true,
  },
  {
    id: 'sharing',
    label: 'External share inventory',
    description: 'Active, expired, and over-viewed share links.',
    category: 'Risk',
    requiresOrg: true,
  },
  {
    id: 'emergency_access',
    label: 'Emergency access grants',
    description: 'Pending, approved, and active emergency access relationships.',
    category: 'Access',
    requiresOrg: true,
  },
  {
    id: 'user_posture',
    label: 'User security posture',
    description: 'MFA, encryption, activity, and SSO status per member.',
    category: 'People',
    requiresOrg: true,
  },
  {
    id: 'privileged_access',
    label: 'Privileged access & API tokens',
    description: 'Elevated roles, expired assignments, and machine tokens.',
    category: 'Access',
    requiresOrg: true,
  },
  {
    id: 'workflows',
    label: 'Workflow completion',
    description: 'Onboarding and assigned workflow progress by user.',
    category: 'People',
    requiresOrg: true,
  },
  {
    id: 'teams',
    label: 'Teams & shared vault',
    description: 'Team membership, roles, and credential counts.',
    category: 'Access',
    requiresOrg: true,
  },
  {
    id: 'sessions',
    label: 'Session & login activity',
    description: 'Logins, devices, browsers, and session duration in the period.',
    category: 'People',
    requiresOrg: true,
  },
  {
    id: 'directory_sync',
    label: 'Directory sync status',
    description: 'Last Entra/Graph sync health and summary.',
    category: 'Ops',
    requiresOrg: true,
  },
  {
    id: 'backup',
    label: 'Backup job history',
    description: 'Platform-wide backup runs (super admin only).',
    category: 'Ops',
    requiresOrg: false,
  },
];

const LEGACY_TYPE_MAP: Record<string, ReportTypeId> = {
  security: 'vault_health',
  audit: 'audit_export',
  compliance: 'compliance_pack',
  usage: 'sessions',
};

export function resolveReportType(raw: string | undefined): ReportTypeId | null {
  if (!raw) return null;
  if (REPORT_CATALOG.some((c) => c.id === raw)) return raw as ReportTypeId;
  return LEGACY_TYPE_MAP[raw] || null;
}

export function periodDays(period: ReportPeriod): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
}

export function periodStart(period: ReportPeriod, now = new Date()): Date {
  const days = periodDays(period);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
