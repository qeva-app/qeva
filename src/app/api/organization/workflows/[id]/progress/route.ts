import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { isOrgAccount } from '@/lib/workflows';

type Ctx = { params: { id: string } };

/** Admin: per-user completion progress for a workflow. */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, accountType: true },
  });
  if (!admin || !isOrgAccount(admin) || !admin.organizationId) {
    return NextResponse.json({ error: 'Organization only' }, { status: 400 });
  }

  const workflow = await prisma.workflow.findFirst({
    where: { id: params.id, organizationId: admin.organizationId },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!workflow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const members = await prisma.user.findMany({
    where: {
      organizationId: admin.organizationId,
      isActive: true,
      accountType: 'ORGANIZATION',
    },
    select: {
      id: true,
      name: true,
      email: true,
      workflowProgress: {
        where: { workflowId: workflow.id },
        include: { stepCompletions: { select: { stepId: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  const requiredSteps = workflow.steps.filter((s) => s.isRequired);
  const requiredIds = new Set(
    (requiredSteps.length ? requiredSteps : workflow.steps).map((s) => s.id)
  );

  const rows = members.map((m) => {
    const progress = m.workflowProgress[0];
    const done = new Set((progress?.stepCompletions || []).map((c) => c.stepId));
    const requiredDone = [...requiredIds].filter((id) => done.has(id)).length;
    const totalRequired = requiredIds.size;
    return {
      userId: m.id,
      name: m.name,
      email: m.email,
      status: progress?.status || 'NOT_STARTED',
      requiredDone,
      totalRequired,
      completedAt: progress?.completedAt || null,
      percent:
        totalRequired > 0 ? Math.round((requiredDone / totalRequired) * 100) : 0,
    };
  });

  const summary = {
    total: rows.length,
    completed: rows.filter((r) => r.status === 'COMPLETED').length,
    inProgress: rows.filter((r) => r.status === 'IN_PROGRESS').length,
    notStarted: rows.filter(
      (r) => r.status === 'NOT_STARTED' || r.status === 'DISMISSED'
    ).length,
  };

  return NextResponse.json({
    workflow: {
      id: workflow.id,
      name: workflow.name,
      slug: workflow.slug,
    },
    summary,
    members: rows,
  });
}
