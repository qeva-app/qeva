import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  audienceMatches,
  getOrCreateProgress,
  isOrgAccount,
  recomputeProgressStatus,
  syncAutoCompletions,
} from '@/lib/workflows';

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
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
    where: {
      id: params.id,
      organizationId: user.organizationId,
      isActive: true,
    },
    include: { steps: true },
  });
  if (!workflow || !audienceMatches(workflow.audience, session.user.role)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const stepId = String(body.stepId || '');
  const step = workflow.steps.find((s) => s.id === stepId);
  if (!step) {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  }

  const progress = await getOrCreateProgress(workflow.id, session.user.id);
  if (progress.status === 'DISMISSED') {
    await prisma.workflowProgress.update({
      where: { id: progress.id },
      data: { status: 'IN_PROGRESS', dismissedAt: null },
    });
  }

  await prisma.workflowStepCompletion.upsert({
    where: {
      progressId_stepId: { progressId: progress.id, stepId: step.id },
    },
    create: {
      progressId: progress.id,
      stepId: step.id,
      autoCompleted: false,
    },
    update: {},
  });

  await syncAutoCompletions({
    userId: session.user.id,
    workflowId: workflow.id,
    progressId: progress.id,
    steps: workflow.steps,
  });

  const updated = await recomputeProgressStatus(progress.id, workflow.steps);

  return NextResponse.json({
    ok: true,
    status: updated?.status || 'IN_PROGRESS',
    stepId: step.id,
  });
}
