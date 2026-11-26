import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { deleteWorkflowCascade, isOrgAccount, type WorkflowStepInput } from '@/lib/workflows';

type Ctx = { params: { id: string } };

async function requireOrgAdmin(userId: string, role: string | undefined) {
  if (role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, accountType: true },
  });
  if (!user || !isOrgAccount(user) || !user.organizationId) {
    return { error: NextResponse.json({ error: 'Organization only' }, { status: 400 }) };
  }
  return { user };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, accountType: true },
  });
  if (!user || !isOrgAccount(user) || !user.organizationId) {
    return NextResponse.json({ error: 'Organization only' }, { status: 400 });
  }

  const workflow = await prisma.workflow.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!workflow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(workflow);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await requireOrgAdmin(session.user.id, session.user.role);
  if ('error' in gate && gate.error) return gate.error;
  const organizationId = gate.user!.organizationId!;

  const existing = await prisma.workflow.findFirst({
    where: { id: params.id, organizationId },
    include: { steps: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const steps: WorkflowStepInput[] | undefined = Array.isArray(body.steps)
    ? body.steps
    : undefined;

  if (steps) {
    const oldStepIds = existing.steps.map((s) => s.id);
    if (oldStepIds.length) {
      await prisma.workflowStepCompletion.deleteMany({
        where: { stepId: { in: oldStepIds } },
      });
      await prisma.workflowStep.deleteMany({ where: { workflowId: existing.id } });
    }
    await prisma.workflowStep.createMany({
      data: steps.map((s, i) => ({
        workflowId: existing.id,
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
    });
  }

  const workflow = await prisma.workflow.update({
    where: { id: existing.id },
    data: {
      name: body.name != null ? String(body.name).trim() || existing.name : undefined,
      description:
        body.description !== undefined
          ? body.description
            ? String(body.description)
            : null
          : undefined,
      isActive: body.isActive !== undefined ? !!body.isActive : undefined,
      isRequired: body.isRequired !== undefined ? !!body.isRequired : undefined,
      audience: ['ALL', 'ADMIN', 'USER', 'ASSIGNED'].includes(body.audience)
        ? body.audience
        : undefined,
      sortOrder:
        body.sortOrder !== undefined && Number.isFinite(body.sortOrder)
          ? body.sortOrder
          : undefined,
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.WORKFLOW_UPDATED,
    resource: 'workflow',
    details: { workflowId: workflow.id },
    req,
  });

  return NextResponse.json(workflow);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await requireOrgAdmin(session.user.id, session.user.role);
  if ('error' in gate && gate.error) return gate.error;
  const organizationId = gate.user!.organizationId!;

  const existing = await prisma.workflow.findFirst({
    where: { id: params.id, organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.slug === 'general-onboarding') {
    return NextResponse.json(
      { error: 'Cannot delete General Onboarding - disable it instead' },
      { status: 400 }
    );
  }

  await deleteWorkflowCascade(existing.id);

  await logAudit({
    userId: session.user.id,
    action: AuditActions.WORKFLOW_DELETED,
    resource: 'workflow',
    details: { workflowId: existing.id, slug: existing.slug },
    req,
  });

  return NextResponse.json({ ok: true });
}
