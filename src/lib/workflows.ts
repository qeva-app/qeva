import prisma from '@/lib/db';
import { allowsCompanyAccounts } from '@/lib/edition';

export type WorkflowType = 'ONBOARDING' | 'CUSTOM';
export type WorkflowAudience = 'ALL' | 'ADMIN' | 'USER' | 'ASSIGNED';
export type WorkflowStepType = 'INFO' | 'LINK' | 'ACTION';
export type WorkflowActionKey =
  | 'WELCOME'
  | 'ENABLE_ENCRYPTION'
  | 'JOIN_TEAM'
  | 'CREATE_PASSWORD'
  | 'OPEN_GENERATOR'
  | 'REVIEW_HEALTH'
  | 'CUSTOM';

export type WorkflowProgressStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DISMISSED';

export interface WorkflowStepInput {
  id?: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  stepType: WorkflowStepType;
  actionKey?: WorkflowActionKey | string | null;
  href?: string | null;
  isRequired?: boolean;
}

export const GENERAL_ONBOARDING_SLUG = 'general-onboarding';

export const DEFAULT_ONBOARDING_STEPS: Omit<WorkflowStepInput, 'id'>[] = [
  {
    title: 'Welcome to your org vault',
    description:
      'Qeva keeps personal, team, and global credentials encrypted and role-scoped. This short checklist gets your account ready.',
    sortOrder: 0,
    stepType: 'INFO',
    actionKey: 'WELCOME',
    href: null,
    isRequired: true,
  },
  {
    title: 'Enable encryption',
    description: 'Set a master password so personal vault secrets use per-user master-key encryption.',
    sortOrder: 1,
    stepType: 'ACTION',
    actionKey: 'ENABLE_ENCRYPTION',
    href: '/settings',
    isRequired: true,
  },
  {
    title: 'Join a team',
    description: 'Teams share credentials with membership roles. Join or ask an admin to invite you.',
    sortOrder: 2,
    stepType: 'ACTION',
    actionKey: 'JOIN_TEAM',
    href: '/teams',
    isRequired: true,
  },
  {
    title: 'Add your first password',
    description: 'Store a credential in your personal or team vault.',
    sortOrder: 3,
    stepType: 'ACTION',
    actionKey: 'CREATE_PASSWORD',
    href: '/vault?action=add',
    isRequired: true,
  },
  {
    title: 'Generate a strong secret',
    description: 'Use the generator to create a policy-compliant password or passphrase.',
    sortOrder: 4,
    stepType: 'LINK',
    actionKey: 'OPEN_GENERATOR',
    href: '/generator',
    isRequired: false,
  },
  {
    title: 'Review password health',
    description: 'Check weak, reused, or aging credentials across your vault.',
    sortOrder: 5,
    stepType: 'LINK',
    actionKey: 'REVIEW_HEALTH',
    href: '/health',
    isRequired: false,
  },
];

export function isOrgAccount(user: {
  accountType?: string | null;
  organizationId?: string | null;
}): boolean {
  // Community Docker is individuals-only — treat everyone as personal vault.
  if (!allowsCompanyAccounts()) return false;
  return user.accountType === 'ORGANIZATION' && !!user.organizationId;
}

export function audienceMatches(
  audience: string,
  role: string | null | undefined
): boolean {
  const r = (role || 'USER').toUpperCase();
  if (audience === 'ASSIGNED') return false;
  if (audience === 'ALL') return true;
  if (audience === 'ADMIN') return r === 'ADMIN';
  if (audience === 'USER') return r !== 'ADMIN';
  return true;
}

/** Visible if audience matches role, or the user has an explicit assignment. */
export function userCanSeeWorkflow(
  audience: string,
  role: string | null | undefined,
  isAssigned: boolean
): boolean {
  return audienceMatches(audience, role) || isAssigned;
}

export async function countDirectReports(managerId: string): Promise<number> {
  return prisma.user.count({
    where: { managerId, isActive: true },
  });
}

export async function canAssignWorkflows(params: {
  userId: string;
  role?: string | null;
}): Promise<boolean> {
  if ((params.role || '').toUpperCase() === 'ADMIN') return true;
  return (await countDirectReports(params.userId)) > 0;
}

/** Org members an actor may assign workflows to. */
export async function listAssignableUsers(params: {
  actorId: string;
  role?: string | null;
  organizationId: string;
}): Promise<{ id: string; name: string | null; email: string }[]> {
  const isAdmin = (params.role || '').toUpperCase() === 'ADMIN';
  return prisma.user.findMany({
    where: {
      organizationId: params.organizationId,
      isActive: true,
      accountType: 'ORGANIZATION',
      ...(isAdmin ? {} : { managerId: params.actorId }),
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
}

export async function getAssignedWorkflowIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.workflowAssignment.findMany({
    where: { userId },
    select: { workflowId: true },
  });
  return new Set(rows.map((r) => r.workflowId));
}

type SampleWorkflowDef = {
  slug: string;
  name: string;
  type: WorkflowType;
  description: string;
  isActive: boolean;
  isRequired: boolean;
  audience: WorkflowAudience;
  sortOrder: number;
  steps: Omit<WorkflowStepInput, 'id'>[];
};

/** Optional sample checklists seeded once per org (idempotent by slug). */
export const SAMPLE_WORKFLOWS: SampleWorkflowDef[] = [
  {
    slug: 'security-hygiene',
    name: 'Security hygiene',
    type: 'CUSTOM',
    description:
      'Quarterly-style pass: strengthen secrets, check health, and confirm encryption is on.',
    isActive: true,
    isRequired: false,
    audience: 'ALL',
    sortOrder: 1,
    steps: [
      {
        title: 'Confirm encryption is enabled',
        description: 'Personal vault entries should use your master password.',
        sortOrder: 0,
        stepType: 'ACTION',
        actionKey: 'ENABLE_ENCRYPTION',
        href: '/settings',
        isRequired: true,
      },
      {
        title: 'Generate a strong password',
        description: 'Create a policy-compliant secret before rotating anything important.',
        sortOrder: 1,
        stepType: 'LINK',
        actionKey: 'OPEN_GENERATOR',
        href: '/generator',
        isRequired: true,
      },
      {
        title: 'Review password health',
        description: 'Fix weak, reused, or aging credentials flagged in Health.',
        sortOrder: 2,
        stepType: 'LINK',
        actionKey: 'REVIEW_HEALTH',
        href: '/health',
        isRequired: true,
      },
      {
        title: 'Add or rotate one vault entry',
        description: 'Practice storing a fresh credential in your vault.',
        sortOrder: 3,
        stepType: 'ACTION',
        actionKey: 'CREATE_PASSWORD',
        href: '/vault?action=add',
        isRequired: false,
      },
    ],
  },
  {
    slug: 'admin-workspace-setup',
    name: 'Admin workspace setup',
    type: 'CUSTOM',
    description: 'First-week checklist for organization admins configuring Qeva for the team.',
    isActive: true,
    isRequired: false,
    audience: 'ADMIN',
    sortOrder: 2,
    steps: [
      {
        title: 'Create or review teams',
        description: 'Teams control who can see shared credentials.',
        sortOrder: 0,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/teams',
        isRequired: true,
      },
      {
        title: 'Invite or review users',
        description: 'Make sure the right people have org access and roles.',
        sortOrder: 1,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/users',
        isRequired: true,
      },
      {
        title: 'Tune org workflows',
        description: 'Activate, edit, or retire checklists under Workflows → Manage.',
        sortOrder: 2,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/workflows?tab=manage',
        isRequired: false,
      },
      {
        title: 'Set password policy',
        description: 'Define length and complexity rules under Settings.',
        sortOrder: 3,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/settings',
        isRequired: false,
      },
    ],
  },
  {
    slug: 'browser-extension',
    name: 'Browser extension',
    type: 'CUSTOM',
    description: 'Connect the Qeva Chrome/Edge extension for autofill and save prompts.',
    isActive: true,
    isRequired: false,
    audience: 'ALL',
    sortOrder: 3,
    steps: [
      {
        title: 'Create an access token',
        description:
          'In Settings → Access Tokens, create a token with passwords read and write scopes.',
        sortOrder: 0,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/settings',
        isRequired: true,
      },
      {
        title: 'Install the extension',
        description:
          'Load the Qeva extension in Chrome or Edge and paste the token in the popup.',
        sortOrder: 1,
        stepType: 'INFO',
        actionKey: 'CUSTOM',
        href: null,
        isRequired: true,
      },
      {
        title: 'Save a login from a site',
        description:
          'Submit a login form and use the Save to Qeva prompt, or add the site from the vault.',
        sortOrder: 2,
        stepType: 'ACTION',
        actionKey: 'CREATE_PASSWORD',
        href: '/vault',
        isRequired: false,
      },
    ],
  },
  {
    slug: 'offboarding',
    name: 'Offboarding',
    type: 'CUSTOM',
    description:
      'Admin checklist when someone leaves: reclaim shared access, rotate secrets, and close accounts.',
    isActive: true,
    isRequired: false,
    audience: 'ASSIGNED',
    sortOrder: 4,
    steps: [
      {
        title: 'Identify the departing member',
        description: 'Confirm which user is leaving and which teams they belong to.',
        sortOrder: 0,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/users',
        isRequired: true,
      },
      {
        title: 'Remove from teams',
        description: 'Revoke team membership so shared vault entries are no longer visible.',
        sortOrder: 1,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/teams',
        isRequired: true,
      },
      {
        title: 'Rotate shared credentials they could access',
        description:
          'Change passwords for team or global entries the person used; store the new secrets in the vault.',
        sortOrder: 2,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/vault?tab=teams',
        isRequired: true,
      },
      {
        title: 'Review emergency access',
        description: 'Cancel any pending emergency-access grants involving that user.',
        sortOrder: 3,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/settings',
        isRequired: false,
      },
      {
        title: 'Deactivate or remove the user account',
        description: 'Disable login so they cannot open Qeva after their last day.',
        sortOrder: 4,
        stepType: 'LINK',
        actionKey: 'CUSTOM',
        href: '/users',
        isRequired: true,
      },
      {
        title: 'Confirm password health after rotation',
        description: 'Spot any weak or reused secrets introduced during the handoff.',
        sortOrder: 5,
        stepType: 'LINK',
        actionKey: 'REVIEW_HEALTH',
        href: '/health',
        isRequired: false,
      },
    ],
  },
];

function stepsCreateData(steps: Omit<WorkflowStepInput, 'id'>[]) {
  return steps.map((s) => ({
    title: s.title,
    description: s.description ?? null,
    sortOrder: s.sortOrder,
    stepType: s.stepType,
    actionKey: s.actionKey ?? null,
    href: s.href ?? null,
    isRequired: s.isRequired ?? true,
  }));
}

/** Ensure the org has General Onboarding plus sample workflows (idempotent by slug). */
export async function ensureGeneralOnboarding(organizationId: string) {
  const existing = await prisma.workflow.findUnique({
    where: {
      organizationId_slug: {
        organizationId,
        slug: GENERAL_ONBOARDING_SLUG,
      },
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  const onboarding =
    existing ||
    (await prisma.workflow.create({
      data: {
        organizationId,
        name: 'General Onboarding',
        slug: GENERAL_ONBOARDING_SLUG,
        type: 'ONBOARDING',
        description:
          'Default checklist for new organization members. Admins can edit steps under Workflows → Manage.',
        isActive: true,
        isRequired: true,
        audience: 'ALL',
        sortOrder: 0,
        steps: { create: stepsCreateData(DEFAULT_ONBOARDING_STEPS) },
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    }));

  for (const sample of SAMPLE_WORKFLOWS) {
    const found = await prisma.workflow.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug: sample.slug,
        },
      },
    });
    if (found) {
      // One-time sample fix: Offboarding is assignment-targeted
      if (sample.slug === 'offboarding' && found.audience === 'ADMIN') {
        await prisma.workflow.update({
          where: { id: found.id },
          data: { audience: 'ASSIGNED' },
        });
      }
      continue;
    }
    await prisma.workflow.create({
      data: {
        organizationId,
        name: sample.name,
        slug: sample.slug,
        type: sample.type,
        description: sample.description,
        isActive: sample.isActive,
        isRequired: sample.isRequired,
        audience: sample.audience,
        sortOrder: sample.sortOrder,
        steps: { create: stepsCreateData(sample.steps) },
      },
    });
  }

  return onboarding;
}

export async function detectAutoCompletedStepIds(params: {
  userId: string;
  steps: { id: string; actionKey: string | null }[];
}): Promise<Set<string>> {
  const keys = new Set(
    params.steps.map((s) => s.actionKey).filter(Boolean) as string[]
  );
  const done = new Set<string>();

  const needsEnc = keys.has('ENABLE_ENCRYPTION');
  const needsTeam = keys.has('JOIN_TEAM');
  const needsPw = keys.has('CREATE_PASSWORD');

  const [user, teamCount, pwCount] = await Promise.all([
    needsEnc
      ? prisma.user.findUnique({
          where: { id: params.userId },
          select: { encryptionEnabled: true },
        })
      : Promise.resolve(null),
    needsTeam
      ? prisma.teamMembership.count({
          where: { userId: params.userId, isActive: true },
        })
      : Promise.resolve(0),
    needsPw
      ? prisma.passwordEntry.count({ where: { userId: params.userId } })
      : Promise.resolve(0),
  ]);

  for (const step of params.steps) {
    if (step.actionKey === 'ENABLE_ENCRYPTION' && user?.encryptionEnabled) {
      done.add(step.id);
    }
    if (step.actionKey === 'JOIN_TEAM' && teamCount > 0) {
      done.add(step.id);
    }
    if (step.actionKey === 'CREATE_PASSWORD' && pwCount > 0) {
      done.add(step.id);
    }
  }

  return done;
}

export async function syncAutoCompletions(params: {
  userId: string;
  workflowId: string;
  progressId: string;
  steps: { id: string; actionKey: string | null; isRequired: boolean }[];
}) {
  const autoIds = await detectAutoCompletedStepIds({
    userId: params.userId,
    steps: params.steps,
  });

  if (autoIds.size === 0) return;

  const existing = await prisma.workflowStepCompletion.findMany({
    where: { progressId: params.progressId },
    select: { stepId: true },
  });
  const have = new Set(existing.map((e) => e.stepId));

  const toCreate = [...autoIds].filter((id) => !have.has(id));
  if (toCreate.length > 0) {
    await prisma.workflowStepCompletion.createMany({
      data: toCreate.map((stepId) => ({
        progressId: params.progressId,
        stepId,
        autoCompleted: true,
      })),
    });
  }

  await recomputeProgressStatus(params.progressId, params.steps);
}

export async function recomputeProgressStatus(
  progressId: string,
  steps: { id: string; isRequired: boolean }[]
) {
  const completions = await prisma.workflowStepCompletion.findMany({
    where: { progressId },
    select: { stepId: true },
  });
  const done = new Set(completions.map((c) => c.stepId));
  const required = steps.filter((s) => s.isRequired);
  const requiredDone =
    required.length === 0
      ? steps.length > 0 && steps.every((s) => done.has(s.id))
      : required.every((s) => done.has(s.id));
  const anyDone = done.size > 0;

  let status: WorkflowProgressStatus = 'NOT_STARTED';
  if (requiredDone && (required.length > 0 || steps.every((s) => done.has(s.id)))) {
    status = 'COMPLETED';
  } else if (anyDone) {
    status = 'IN_PROGRESS';
  }

  const progress = await prisma.workflowProgress.findUnique({
    where: { id: progressId },
  });
  if (!progress || progress.status === 'DISMISSED') return progress;

  return prisma.workflowProgress.update({
    where: { id: progressId },
    data: {
      status,
      startedAt: progress.startedAt ?? (anyDone ? new Date() : null),
      completedAt: status === 'COMPLETED' ? progress.completedAt ?? new Date() : null,
    },
  });
}

/** Manual cascade delete (SQL Server forbids multi-path Cascade). */
export async function deleteWorkflowCascade(workflowId: string) {
  const steps = await prisma.workflowStep.findMany({
    where: { workflowId },
    select: { id: true },
  });
  const stepIds = steps.map((s) => s.id);
  const progresses = await prisma.workflowProgress.findMany({
    where: { workflowId },
    select: { id: true },
  });
  const progressIds = progresses.map((p) => p.id);

  if (progressIds.length) {
    await prisma.workflowStepCompletion.deleteMany({
      where: { progressId: { in: progressIds } },
    });
  }
  if (stepIds.length) {
    await prisma.workflowStepCompletion.deleteMany({
      where: { stepId: { in: stepIds } },
    });
  }
  await prisma.workflowAssignment.deleteMany({ where: { workflowId } });
  await prisma.workflowProgress.deleteMany({ where: { workflowId } });
  await prisma.workflowStep.deleteMany({ where: { workflowId } });
  await prisma.workflow.delete({ where: { id: workflowId } });
}

export async function getOrCreateProgress(workflowId: string, userId: string) {
  const existing = await prisma.workflowProgress.findUnique({
    where: { workflowId_userId: { workflowId, userId } },
  });
  if (existing) return existing;
  return prisma.workflowProgress.create({
    data: { workflowId, userId, status: 'NOT_STARTED' },
  });
}

/** Re-run auto-complete detection for all active org workflows (after team join / password create). */
export async function syncWorkflowsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, accountType: true },
  });
  if (!user?.organizationId || user.accountType !== 'ORGANIZATION') return;

  const workflows = await prisma.workflow.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  for (const wf of workflows) {
    const progress = await getOrCreateProgress(wf.id, userId);
    if (progress.status === 'DISMISSED' || progress.status === 'COMPLETED') continue;
    await syncAutoCompletions({
      userId,
      workflowId: wf.id,
      progressId: progress.id,
      steps: wf.steps,
    });
  }
}
