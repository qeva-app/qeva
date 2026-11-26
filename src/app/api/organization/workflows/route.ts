import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  canAssignWorkflows,
  ensureGeneralOnboarding,
  isOrgAccount,
  type WorkflowStepInput,
} from '@/lib/workflows';

const AUDIENCES = ['ALL', 'ADMIN', 'USER', 'ASSIGNED'] as const;

async function getOrgUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, accountType: true },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getOrgUser(session.user.id);
  if (!user || !isOrgAccount(user) || !user.organizationId) {
    return NextResponse.json({
      isOrg: false,
      workflows: [],
      canEdit: false,
      canAssign: false,
    });
  }

  const canAssign = await canAssignWorkflows({
    userId: session.user.id,
    role: session.user.role,
  });
  const canEdit = session.user.role === 'ADMIN';
  if (!canEdit && !canAssign) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureGeneralOnboarding(user.organizationId);

  const workflows = await prisma.workflow.findMany({
    where: { organizationId: user.organizationId },
    include: {
      steps: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({
    isOrg: true,
    canEdit,
    canAssign,
    workflows: workflows.map((w) => ({
      ...w,
      assigneeCount: w._count.assignments,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await getOrgUser(session.user.id);
  if (!user || !isOrgAccount(user) || !user.organizationId) {
    return NextResponse.json({ error: 'Organization only' }, { status: 400 });
  }

  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const slugBase = String(body.slug || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'workflow';

  let slug = slugBase;
  let n = 1;
  while (
    await prisma.workflow.findUnique({
      where: {
        organizationId_slug: { organizationId: user.organizationId, slug },
      },
    })
  ) {
    slug = `${slugBase}-${++n}`;
  }

  const steps: WorkflowStepInput[] = Array.isArray(body.steps) ? body.steps : [];

  const workflow = await prisma.workflow.create({
    data: {
      organizationId: user.organizationId,
      name,
      slug,
      type: body.type === 'ONBOARDING' ? 'ONBOARDING' : 'CUSTOM',
      description: body.description ? String(body.description) : null,
      isActive: body.isActive !== false,
      isRequired: body.isRequired !== false,
      audience: (AUDIENCES as readonly string[]).includes(body.audience)
        ? body.audience
        : 'ALL',
      sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
      steps: {
        create: steps.map((s, i) => ({
          title: String(s.title || `Step ${i + 1}`),
          description: s.description ? String(s.description) : null,
          sortOrder: s.sortOrder ?? i,
          stepType: ['INFO', 'LINK', 'ACTION'].includes(String(s.stepType))
            ? String(s.stepType)
            : 'ACTION',
          actionKey: s.actionKey ? String(s.actionKey) : 'CUSTOM',
          href: s.href ? String(s.href) : null,
          isRequired: s.isRequired !== false,
        })),
      },
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.WORKFLOW_CREATED,
    resource: 'workflow',
    details: { workflowId: workflow.id, slug: workflow.slug },
    req,
  });

  return NextResponse.json(workflow, { status: 201 });
}
