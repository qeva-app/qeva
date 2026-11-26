import prisma from '@/lib/db';
import {
  REPORT_CATALOG,
  periodStart,
  type ReportPeriod,
  type ReportTypeId,
} from '@/lib/reports-catalog';

export {
  REPORT_CATALOG,
  resolveReportType,
  periodDays,
  periodStart,
  type ReportPeriod,
  type ReportFormat,
  type ReportTypeId,
  type ReportCatalogItem,
} from '@/lib/reports-catalog';

export type GeneratedReport = {
  summary: Record<string, unknown>;
  rows: Record<string, unknown>[];
  findings: string[];
  recommendations: string[];
  columns: string[];
};

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString() : '';
}

/** Escape one CSV cell. */
export function csvCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(csvCell).join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(','));
  return [header, ...body].join('\n');
}

export function buildDownloadPayload(
  format: string,
  name: string,
  dataJson: string | null | undefined
): { body: string; contentType: string; filename: string } {
  let parsed: { columns?: string[]; rows?: Record<string, unknown>[]; summary?: Record<string, unknown> } = {};
  try {
    parsed = JSON.parse(dataJson || '{}');
  } catch {
    parsed = {};
  }
  const columns = parsed.columns?.length
    ? parsed.columns
    : parsed.rows?.[0]
      ? Object.keys(parsed.rows[0])
      : [];
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const safeName = (name || 'report').replace(/[^\w\-]+/g, '_');

  if (String(format).toUpperCase() === 'JSON') {
    return {
      body: JSON.stringify(parsed, null, 2),
      contentType: 'application/json',
      filename: `${safeName}.json`,
    };
  }

  // CSV is the real export; Excel option downloads CSV (Excel opens it).
  const csv = columns.length ? rowsToCsv(columns, rows) : rowsToCsv(['summary'], [{ summary: JSON.stringify(parsed.summary || {}) }]);
  return {
    body: csv,
    contentType: 'text/csv; charset=utf-8',
    filename: `${safeName}.csv`,
  };
}

async function genAuditExport(organizationId: string, start: Date): Promise<GeneratedReport> {
  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: start },
      user: { organizationId },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
    select: {
      id: true,
      action: true,
      resource: true,
      details: true,
      ipAddress: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  const columns = ['when', 'user', 'email', 'action', 'resource', 'ip', 'details'];
  const rows = logs.map((l) => ({
    when: iso(l.createdAt),
    user: l.user?.name || '',
    email: l.user?.email || '',
    action: l.action,
    resource: l.resource || '',
    ip: l.ipAddress || '',
    details: l.details || '',
  }));

  const findings: string[] = [];
  if (logs.length === 0) findings.push('No audit events in this period for your organization');
  if (logs.length >= 10000) findings.push('Export capped at 10,000 events — narrow the period if needed');

  return {
    summary: { totalEvents: logs.length, capped: logs.length >= 10000 },
    rows,
    columns,
    findings,
    recommendations: logs.length === 0 ? ['Confirm audit logging is enabled for admin actions'] : [],
  };
}

async function genVaultHealth(organizationId: string): Promise<GeneratedReport> {
  // shortcut: strength/expiry/staleness only (no decrypt/reuse) — upgrade when org-wide reuse reports are needed
  const passwords = await prisma.passwordEntry.findMany({
    where: {
      OR: [{ user: { organizationId } }, { team: { organizationId } }],
    },
    select: {
      id: true,
      title: true,
      category: true,
      strength: true,
      expiryDate: true,
      updatedAt: true,
      isGlobal: true,
      isTeam: true,
      user: { select: { email: true } },
      team: { select: { name: true } },
    },
  });

  const now = new Date();
  const columns = [
    'title',
    'ownerEmail',
    'team',
    'category',
    'strength',
    'issues',
    'scope',
    'updatedAt',
    'expiryDate',
  ];
  const rows: Record<string, unknown>[] = [];
  let weak = 0;
  let expired = 0;
  let stale = 0;

  for (const p of passwords) {
    const issues: string[] = [];
    const daysSinceUpdate = Math.floor((now.getTime() - p.updatedAt.getTime()) / 86400000);
    if ((p.strength || 0) < 40) {
      issues.push('weak');
      weak++;
    }
    if (p.expiryDate && p.expiryDate < now) {
      issues.push('expired');
      expired++;
    }
    if (daysSinceUpdate > 90) {
      issues.push('stale');
      stale++;
    }
    if (issues.length === 0) continue;
    rows.push({
      title: p.title,
      ownerEmail: p.user?.email || '',
      team: p.team?.name || '',
      category: p.category || '',
      strength: p.strength ?? 0,
      issues: issues.join('|'),
      scope: p.isGlobal ? 'global' : p.isTeam ? 'team' : 'personal',
      updatedAt: iso(p.updatedAt),
      expiryDate: iso(p.expiryDate),
    });
  }

  const findings: string[] = [];
  if (weak) findings.push(`${weak} weak credentials (strength < 40)`);
  if (expired) findings.push(`${expired} expired credentials`);
  if (stale) findings.push(`${stale} credentials not rotated in 90+ days`);

  const recommendations: string[] = [];
  if (weak) recommendations.push('Rotate weak passwords with the generator');
  if (expired) recommendations.push('Clear expired credentials immediately');

  return {
    summary: { totalCredentials: passwords.length, exceptions: rows.length, weak, expired, stale },
    rows,
    columns,
    findings,
    recommendations,
  };
}

async function genSharing(organizationId: string, now: Date): Promise<GeneratedReport> {
  const links = await prisma.sharedLink.findMany({
    where: { creator: { organizationId } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      isActive: true,
      viewedBy: true,
      viewedAt: true,
      createdAt: true,
      creator: { select: { email: true, name: true } },
      passwordEntry: { select: { title: true } },
    },
  });

  const columns = [
    'credential',
    'createdBy',
    'active',
    'expired',
    'overViewed',
    'views',
    'maxViews',
    'expiresAt',
    'createdAt',
    'lastViewer',
  ];
  let activeOpen = 0;
  let expiredActive = 0;
  let overViewed = 0;

  const rows = links.map((l) => {
    const expired = l.expiresAt < now;
    const over = l.viewCount >= l.maxViews;
    if (l.isActive && !expired) activeOpen++;
    if (l.isActive && expired) expiredActive++;
    if (l.isActive && over) overViewed++;
    return {
      credential: l.passwordEntry?.title || '',
      createdBy: l.creator?.email || '',
      active: l.isActive,
      expired,
      overViewed: over,
      views: l.viewCount,
      maxViews: l.maxViews,
      expiresAt: iso(l.expiresAt),
      createdAt: iso(l.createdAt),
      lastViewer: l.viewedBy || '',
    };
  });

  const findings: string[] = [];
  if (expiredActive) findings.push(`${expiredActive} share links still marked active after expiry`);
  if (overViewed) findings.push(`${overViewed} active links at or over max views`);

  return {
    summary: { total: links.length, activeOpen, expiredActive, overViewed },
    rows,
    columns,
    findings,
    recommendations:
      expiredActive || overViewed
        ? ['Revoke expired or exhausted share links']
        : [],
  };
}

async function genEmergencyAccess(organizationId: string): Promise<GeneratedReport> {
  const grants = await prisma.emergencyAccess.findMany({
    where: {
      OR: [{ grantor: { organizationId } }, { grantee: { organizationId } }],
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      status: true,
      waitingPeriod: true,
      requestedAt: true,
      approvedAt: true,
      accessExpiresAt: true,
      createdAt: true,
      grantor: { select: { email: true, name: true } },
      grantee: { select: { email: true, name: true } },
    },
  });

  const columns = [
    'grantor',
    'grantee',
    'status',
    'waitingHours',
    'requestedAt',
    'approvedAt',
    'accessExpiresAt',
    'createdAt',
  ];
  const rows = grants.map((g) => ({
    grantor: g.grantor?.email || '',
    grantee: g.grantee?.email || '',
    status: g.status,
    waitingHours: g.waitingPeriod,
    requestedAt: iso(g.requestedAt),
    approvedAt: iso(g.approvedAt),
    accessExpiresAt: iso(g.accessExpiresAt),
    createdAt: iso(g.createdAt),
  }));

  const active = grants.filter((g) => g.status === 'ACTIVE' || g.status === 'REQUESTED').length;
  const findings = active ? [`${active} emergency grants in ACTIVE/REQUESTED state`] : [];

  return {
    summary: {
      total: grants.length,
      byStatus: grants.reduce<Record<string, number>>((acc, g) => {
        acc[g.status] = (acc[g.status] || 0) + 1;
        return acc;
      }, {}),
    },
    rows,
    columns,
    findings,
    recommendations: active ? ['Review open emergency access grants'] : [],
  };
}

async function genUserPosture(organizationId: string): Promise<GeneratedReport> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: {
      email: true,
      name: true,
      department: true,
      isActive: true,
      isVerified: true,
      twoFactorEnabled: true,
      encryptionEnabled: true,
      ssoProvider: true,
      lastUnlockAt: true,
      createdAt: true,
      manager: { select: { email: true } },
    },
    orderBy: { email: 'asc' },
  });

  const columns = [
    'email',
    'name',
    'department',
    'manager',
    'active',
    'verified',
    'mfa',
    'encryption',
    'ssoProvider',
    'lastUnlockAt',
    'createdAt',
  ];
  const rows = users.map((u) => ({
    email: u.email,
    name: u.name || '',
    department: u.department || '',
    manager: u.manager?.email || '',
    active: u.isActive,
    verified: u.isVerified,
    mfa: u.twoFactorEnabled,
    encryption: u.encryptionEnabled,
    ssoProvider: u.ssoProvider || 'local',
    lastUnlockAt: iso(u.lastUnlockAt),
    createdAt: iso(u.createdAt),
  }));

  const active = users.filter((u) => u.isActive);
  const noMfa = active.filter((u) => !u.twoFactorEnabled).length;
  const noEnc = active.filter((u) => !u.encryptionEnabled).length;
  const findings: string[] = [];
  if (noMfa) findings.push(`${noMfa} active users without MFA`);
  if (noEnc) findings.push(`${noEnc} active users without encryption setup`);

  return {
    summary: {
      total: users.length,
      active: active.length,
      mfaEnabled: active.filter((u) => u.twoFactorEnabled).length,
      encryptionEnabled: active.filter((u) => u.encryptionEnabled).length,
    },
    rows,
    columns,
    findings,
    recommendations: [
      ...(noMfa ? ['Enforce MFA for remaining users'] : []),
      ...(noEnc ? ['Complete encryption setup for remaining users'] : []),
    ],
  };
}

async function genPrivilegedAccess(organizationId: string, now: Date): Promise<GeneratedReport> {
  const [assignments, tokens] = await Promise.all([
    prisma.userRoleAssignment.findMany({
      where: { isActive: true, user: { organizationId } },
      select: {
        isPrimary: true,
        expiresAt: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        role: { select: { name: true, isSystem: true } },
      },
    }),
    prisma.accessToken.findMany({
      where: { user: { organizationId } },
      select: {
        name: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  const columns = ['kind', 'principal', 'detail', 'active', 'expiresAt', 'lastUsedAt', 'createdAt', 'flags'];
  const rows: Record<string, unknown>[] = [];

  for (const a of assignments) {
    const flags: string[] = [];
    if (a.expiresAt && a.expiresAt < now) flags.push('expired');
    if (a.role.name === 'ADMIN' || a.role.name === 'MANAGER') flags.push('elevated');
    if (a.isPrimary) flags.push('primary');
    rows.push({
      kind: 'role',
      principal: a.user.email,
      detail: a.role.name,
      active: true,
      expiresAt: iso(a.expiresAt),
      lastUsedAt: '',
      createdAt: iso(a.createdAt),
      flags: flags.join('|'),
    });
  }

  for (const t of tokens) {
    const flags: string[] = [];
    if (t.expiresAt && t.expiresAt < now) flags.push('expired');
    if (!t.lastUsedAt) flags.push('never_used');
    if (!t.isActive) flags.push('inactive');
    rows.push({
      kind: 'api_token',
      principal: t.user.email,
      detail: t.name,
      active: t.isActive,
      expiresAt: iso(t.expiresAt),
      lastUsedAt: iso(t.lastUsedAt),
      createdAt: iso(t.createdAt),
      flags: flags.join('|'),
    });
  }

  const expiredRoles = assignments.filter((a) => a.expiresAt && a.expiresAt < now).length;
  const staleTokens = tokens.filter((t) => t.isActive && !t.lastUsedAt).length;
  const findings: string[] = [];
  if (expiredRoles) findings.push(`${expiredRoles} role assignments past expiry still active`);
  if (staleTokens) findings.push(`${staleTokens} active API tokens never used`);

  return {
    summary: {
      roleAssignments: assignments.length,
      apiTokens: tokens.length,
      expiredRoles,
      staleTokens,
    },
    rows,
    columns,
    findings,
    recommendations: findings.length ? ['Revoke expired roles and unused API tokens'] : [],
  };
}

async function genWorkflows(organizationId: string): Promise<GeneratedReport> {
  const [workflows, orgUsers] = await Promise.all([
    prisma.workflow.findMany({
      where: { organizationId, isActive: true },
      select: {
        name: true,
        type: true,
        isRequired: true,
        progress: {
          select: {
            status: true,
            startedAt: true,
            completedAt: true,
            user: { select: { email: true, name: true, isActive: true } },
          },
        },
        assignments: {
          select: { user: { select: { email: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { email: true, name: true },
    }),
  ]);

  const columns = ['workflow', 'type', 'required', 'user', 'status', 'startedAt', 'completedAt'];
  const rows: Record<string, unknown>[] = [];
  let incompleteRequired = 0;

  for (const w of workflows) {
    const progressByEmail = new Map(w.progress.map((p) => [p.user.email, p]));
    const assignees =
      w.type === 'ONBOARDING'
        ? orgUsers.map((u) => ({ email: u.email, name: u.name }))
        : w.assignments.map((a) => ({ email: a.user.email, name: '' }));

    for (const a of assignees) {
      const p = progressByEmail.get(a.email);
      const status = p?.status || 'NOT_STARTED';
      if (w.isRequired && status !== 'COMPLETED' && status !== 'DISMISSED') incompleteRequired++;
      rows.push({
        workflow: w.name,
        type: w.type,
        required: w.isRequired,
        user: a.email,
        status,
        startedAt: iso(p?.startedAt),
        completedAt: iso(p?.completedAt),
      });
    }
  }

  const findings = incompleteRequired
    ? [`${incompleteRequired} incomplete required workflow assignments`]
    : [];

  return {
    summary: { workflows: workflows.length, rows: rows.length, incompleteRequired },
    rows,
    columns,
    findings,
    recommendations: incompleteRequired ? ['Follow up on incomplete required onboarding'] : [],
  };
}

async function genTeams(organizationId: string): Promise<GeneratedReport> {
  const teams = await prisma.team.findMany({
    where: { organizationId, isActive: true },
    select: {
      name: true,
      isPrivate: true,
      memberships: {
        where: { isActive: true },
        select: {
          role: true,
          user: { select: { email: true, name: true } },
        },
      },
      _count: { select: { passwords: true } },
    },
  });

  const columns = ['team', 'private', 'memberEmail', 'memberName', 'memberRole', 'credentialCount'];
  const rows: Record<string, unknown>[] = [];
  for (const t of teams) {
    if (t.memberships.length === 0) {
      rows.push({
        team: t.name,
        private: t.isPrivate,
        memberEmail: '',
        memberName: '',
        memberRole: '',
        credentialCount: t._count.passwords,
      });
      continue;
    }
    for (const m of t.memberships) {
      rows.push({
        team: t.name,
        private: t.isPrivate,
        memberEmail: m.user.email,
        memberName: m.user.name || '',
        memberRole: m.role,
        credentialCount: t._count.passwords,
      });
    }
  }

  return {
    summary: { teams: teams.length, membershipRows: rows.length },
    rows,
    columns,
    findings: teams.filter((t) => t._count.passwords === 0).length
      ? [`${teams.filter((t) => t._count.passwords === 0).length} teams have no credentials`]
      : [],
    recommendations: [],
  };
}

async function genSessions(organizationId: string, start: Date): Promise<GeneratedReport> {
  const sessions = await prisma.userSession.findMany({
    where: { loginAt: { gte: start }, user: { organizationId } },
    orderBy: { loginAt: 'desc' },
    take: 10000,
    select: {
      loginAt: true,
      logoutAt: true,
      duration: true,
      ipAddress: true,
      browser: true,
      os: true,
      deviceType: true,
      sessionType: true,
      isActive: true,
      user: { select: { email: true } },
    },
  });

  const columns = [
    'email',
    'loginAt',
    'logoutAt',
    'durationSec',
    'active',
    'browser',
    'os',
    'device',
    'sessionType',
    'ip',
  ];
  const rows = sessions.map((s) => ({
    email: s.user.email,
    loginAt: iso(s.loginAt),
    logoutAt: iso(s.logoutAt),
    durationSec: s.duration ?? '',
    active: s.isActive,
    browser: s.browser || '',
    os: s.os || '',
    device: s.deviceType || '',
    sessionType: s.sessionType || '',
    ip: s.ipAddress || '',
  }));

  const uniqueUsers = new Set(sessions.map((s) => s.user.email)).size;

  return {
    summary: { totalSessions: sessions.length, uniqueUsers },
    rows,
    columns,
    findings: sessions.length === 0 ? ['No sessions in this period'] : [],
    recommendations: [],
  };
}

async function genDirectorySync(organizationId: string): Promise<GeneratedReport> {
  const config = await prisma.directorySyncConfig.findUnique({
    where: { organizationId },
    select: {
      provider: true,
      isActive: true,
      syncManagers: true,
      createMissingUsers: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncSummary: true,
      updatedAt: true,
    },
  });

  const columns = [
    'provider',
    'active',
    'syncManagers',
    'createMissingUsers',
    'lastSyncAt',
    'lastSyncStatus',
    'lastSyncSummary',
  ];

  if (!config) {
    return {
      summary: { configured: false },
      rows: [],
      columns,
      findings: ['Directory sync is not configured for this organization'],
      recommendations: ['Configure Microsoft Graph directory sync under Users'],
    };
  }

  const rows = [
    {
      provider: config.provider,
      active: config.isActive,
      syncManagers: config.syncManagers,
      createMissingUsers: config.createMissingUsers,
      lastSyncAt: iso(config.lastSyncAt),
      lastSyncStatus: config.lastSyncStatus || '',
      lastSyncSummary: config.lastSyncSummary || '',
    },
  ];

  const findings: string[] = [];
  if (!config.isActive) findings.push('Directory sync config is inactive');
  if (config.lastSyncStatus === 'error') findings.push('Last directory sync failed');
  if (config.lastSyncStatus === 'partial') findings.push('Last directory sync completed with errors');

  return {
    summary: {
      configured: true,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncAt: iso(config.lastSyncAt),
    },
    rows,
    columns,
    findings,
    recommendations: findings.length ? ['Re-run directory sync and review Graph permissions'] : [],
  };
}

async function genCompliancePack(organizationId: string, start: Date): Promise<GeneratedReport> {
  const [org, posture, vault, auditSample] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, passwordPolicy: true, status: true },
    }),
    genUserPosture(organizationId),
    genVaultHealth(organizationId),
    prisma.auditLog.count({
      where: { createdAt: { gte: start }, user: { organizationId } },
    }),
  ]);

  let policy: Record<string, unknown> = {};
  try {
    policy = org?.passwordPolicy ? JSON.parse(org.passwordPolicy) : {};
  } catch {
    policy = {};
  }

  const columns = ['section', 'item', 'value', 'status'];
  const rows: Record<string, unknown>[] = [
    { section: 'org', item: 'name', value: org?.name || '', status: 'info' },
    { section: 'org', item: 'status', value: org?.status || '', status: 'info' },
    {
      section: 'policy',
      item: 'passwordPolicy',
      value: JSON.stringify(policy),
      status: Object.keys(policy).length ? 'ok' : 'missing',
    },
    {
      section: 'posture',
      item: 'mfaAdoption',
      value: `${posture.summary.mfaEnabled}/${posture.summary.active}`,
      status:
        Number(posture.summary.mfaEnabled) === Number(posture.summary.active) ? 'ok' : 'gap',
    },
    {
      section: 'posture',
      item: 'encryptionAdoption',
      value: `${posture.summary.encryptionEnabled}/${posture.summary.active}`,
      status:
        Number(posture.summary.encryptionEnabled) === Number(posture.summary.active)
          ? 'ok'
          : 'gap',
    },
    {
      section: 'vault',
      item: 'healthExceptions',
      value: String(vault.summary.exceptions),
      status: Number(vault.summary.exceptions) === 0 ? 'ok' : 'gap',
    },
    {
      section: 'audit',
      item: 'eventsInPeriod',
      value: String(auditSample),
      status: auditSample > 0 ? 'ok' : 'gap',
    },
  ];

  // Attach exception detail as additional rows
  for (const r of vault.rows.slice(0, 500)) {
    rows.push({
      section: 'vault_exception',
      item: String(r.title),
      value: String(r.issues),
      status: 'gap',
    });
  }
  for (const r of posture.rows.filter((u) => !u.mfa || !u.encryption).slice(0, 500)) {
    rows.push({
      section: 'user_exception',
      item: String(r.email),
      value: `mfa=${r.mfa};encryption=${r.encryption}`,
      status: 'gap',
    });
  }

  const findings = [...posture.findings, ...vault.findings];
  if (!Object.keys(policy).length) findings.push('No password policy JSON stored on the organization');

  return {
    summary: {
      organization: org?.name,
      policyPresent: Object.keys(policy).length > 0,
      auditEvents: auditSample,
      posture: posture.summary,
      vault: vault.summary,
    },
    rows,
    columns,
    findings,
    recommendations: [...new Set([...posture.recommendations, ...vault.recommendations])],
  };
}

async function genBackup(start: Date): Promise<GeneratedReport> {
  // shortcut: BackupConfig has no organizationId — platform-wide; callers must gate to super admin
  const jobs = await prisma.backupJob.findMany({
    where: { createdAt: { gte: start } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      status: true,
      startedAt: true,
      completedAt: true,
      size: true,
      error: true,
      createdAt: true,
      config: { select: { name: true } },
    },
  });

  const columns = ['config', 'status', 'startedAt', 'completedAt', 'sizeBytes', 'error', 'createdAt'];
  const rows = jobs.map((j) => ({
    config: j.config.name,
    status: j.status,
    startedAt: iso(j.startedAt),
    completedAt: iso(j.completedAt),
    sizeBytes: j.size != null ? j.size.toString() : '',
    error: j.error || '',
    createdAt: iso(j.createdAt),
  }));

  const failed = jobs.filter((j) => j.status === 'failed').length;
  const findings = failed ? [`${failed} backup jobs failed in this period`] : [];

  return {
    summary: { jobs: jobs.length, failed },
    rows,
    columns,
    findings,
    recommendations: failed ? ['Investigate failed backup jobs and re-run'] : [],
  };
}

export type GenerateReportInput = {
  type: ReportTypeId;
  period: ReportPeriod;
  organizationId: string | null;
  now?: Date;
};

export async function generateReportData(input: GenerateReportInput): Promise<GeneratedReport> {
  const now = input.now || new Date();
  const start = periodStart(input.period, now);
  const catalog = REPORT_CATALOG.find((c) => c.id === input.type);
  if (!catalog) throw new Error('Unknown report type');
  if (catalog.requiresOrg && !input.organizationId) {
    throw new Error('Organization required for this report');
  }

  const orgId = input.organizationId!;

  switch (input.type) {
    case 'audit_export':
      return genAuditExport(orgId, start);
    case 'vault_health':
      return genVaultHealth(orgId);
    case 'sharing':
      return genSharing(orgId, now);
    case 'emergency_access':
      return genEmergencyAccess(orgId);
    case 'user_posture':
      return genUserPosture(orgId);
    case 'privileged_access':
      return genPrivilegedAccess(orgId, now);
    case 'workflows':
      return genWorkflows(orgId);
    case 'teams':
      return genTeams(orgId);
    case 'sessions':
      return genSessions(orgId, start);
    case 'directory_sync':
      return genDirectorySync(orgId);
    case 'compliance_pack':
      return genCompliancePack(orgId, start);
    case 'backup':
      return genBackup(start);
    default:
      throw new Error('Unknown report type');
  }
}
