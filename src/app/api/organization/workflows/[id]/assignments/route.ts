import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  canAssignWorkflows,
  isOrgAccount,
  listAssignableUsers,
} from '@/lib/workflows';

type Ctx = { params: { id: string } };

async function requireAssigner(userId: string, role: string | undefined) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, accountType: true },
  });
  if (!user || !isOrgAccount(user) || !user.organizationId) {
    return { error: NextResponse.json({ error: 'Organization only' }, { status: 400 }) };
  }
  const allowed = await canAssignWorkflows({ userId, role });
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, organizationId: user.organizationId };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await requireAssigner(session.user.id, session.user.role);
  if ('error' in gate && gate.error) return gate.error;

  const workflow = await prisma.workflow.findFirst({
    where: { id: params.id, organizationId: gate.organizationId },
    select: { id: true },
  });
  if (!workflow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [assignable, assignments] = await Promise.all([
    listAssignableUsers({
      actorId: session.user.id,
      role: session.user.role,
      organizationId: gate.organizationId!,
    }),
    prisma.workflowAssignment.findMany({
      where: { workflowId: workflow.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { assignedAt: 'asc' },
    }),
  ]);

  const isAdmin = (session.user.role || '').toUpperCase() === 'ADMIN';
  const assignableIds = new Set(assignable.map((u) => u.id));
  // Admins see all assignees; managers only see people in their assignable scope
  const visibleAssignees = assignments
    .filter((a) => isAdmin || assignableIds.has(a.userId))
    .map((a) => ({
      userId: a.user.id,
      name: a.user.name,
      email: a.user.email,
      assignedAt: a.assignedAt,
    }));

  return NextResponse.json({
    assignable,
    assignees: visibleAssignees,
    assignedUserIds: visibleAssignees.map((a) => a.userId),
  });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await requireAssigner(session.user.id, session.user.role);
  if ('error' in gate && gate.error) return gate.error;

  const workflow = await prisma.workflow.findFirst({
    where: { id: params.id, organizationId: gate.organizationId },
    select: { id: true },
  });
  if (!workflow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const requested: string[] = Array.isArray(body.userIds)
    ? [...new Set((body.userIds as unknown[]).map((id) => String(id)))]
    : [];

  const assignable = await listAssignableUsers({
    actorId: session.user.id,
    role: session.user.role,
    organizationId: gate.organizationId!,
  });
  const allowedIds = new Set(assignable.map((u) => u.id));
  const nextIds = requested.filter((id) => allowedIds.has(id));

  const isAdmin = (session.user.role || '').toUpperCase() === 'ADMIN';

  if (isAdmin) {
    // Full replace of assignees
    await prisma.workflowAssignment.deleteMany({ where: { workflowId: workflow.id } });
    if (nextIds.length) {
      await prisma.workflowAssignment.createMany({
        data: nextIds.map((userId) => ({
          workflowId: workflow.id,
          userId,
          assignedById: session.user.id,
        })),
      });
    }
  } else {
    // Managers: only add/remove within their direct reports; leave others untouched
    const existing = await prisma.workflowAssignment.findMany({
      where: { workflowId: workflow.id },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((e) => e.userId));
    const inScopeExisting = [...existingIds].filter((id) => allowedIds.has(id));
    const toRemove = inScopeExisting.filter((id) => !nextIds.includes(id));
    const toAdd = nextIds.filter((id) => !existingIds.has(id));

    if (toRemove.length) {
      await prisma.workflowAssignment.deleteMany({
        where: { workflowId: workflow.id, userId: { in: toRemove } },
      });
    }
    if (toAdd.length) {
      await prisma.workflowAssignment.createMany({
        data: toAdd.map((userId) => ({
          workflowId: workflow.id,
          userId,
          assignedById: session.user.id,
        })),
      });
    }
  }

  await logAudit({
    userId: session.user.id,
    action: AuditActions.WORKFLOW_ASSIGNED,
    resource: 'workflow',
    details: { workflowId: workflow.id, userIds: nextIds },
    req,
  });

  const assignments = await prisma.workflowAssignment.findMany({
    where: { workflowId: workflow.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { assignedAt: 'asc' },
  });

  return NextResponse.json({
    assignedUserIds: assignments.map((a) => a.userId),
    assignees: assignments.map((a) => ({
      userId: a.user.id,
      name: a.user.name,
      email: a.user.email,
      assignedAt: a.assignedAt,
    })),
  });
}
