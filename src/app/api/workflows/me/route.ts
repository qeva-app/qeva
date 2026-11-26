import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  ensureGeneralOnboarding,
  getAssignedWorkflowIds,
  getOrCreateProgress,
  isOrgAccount,
  syncAutoCompletions,
  userCanSeeWorkflow,
} from '@/lib/workflows';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, accountType: true },
  });

  if (!user || !isOrgAccount(user) || !user.organizationId) {
    return NextResponse.json({ isOrg: false, workflows: [] });
  }

  await ensureGeneralOnboarding(user.organizationId);

  const [workflows, assignedIds] = await Promise.all([
    prisma.workflow.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    getAssignedWorkflowIds(session.user.id),
  ]);

  const role = session.user.role || 'USER';
  const visible = workflows.filter((w) =>
    userCanSeeWorkflow(w.audience, role, assignedIds.has(w.id))
  );

  const result = [];
  for (const wf of visible) {
    const progress = await getOrCreateProgress(wf.id, session.user.id);
    await syncAutoCompletions({
      userId: session.user.id,
      workflowId: wf.id,
      progressId: progress.id,
      steps: wf.steps,
    });

    const fresh = await prisma.workflowProgress.findUnique({
      where: { id: progress.id },
      include: { stepCompletions: true },
    });

    const completedStepIds = new Set(
      (fresh?.stepCompletions || []).map((c) => c.stepId)
    );
    const required = wf.steps.filter((s) => s.isRequired);
    const requiredDone = required.filter((s) => completedStepIds.has(s.id)).length;
    const totalRequired = required.length || wf.steps.length;

    result.push({
      id: wf.id,
      name: wf.name,
      slug: wf.slug,
      type: wf.type,
      description: wf.description,
      isRequired: wf.isRequired,
      audience: wf.audience,
      steps: wf.steps.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        sortOrder: s.sortOrder,
        stepType: s.stepType,
        actionKey: s.actionKey,
        href: s.href,
        isRequired: s.isRequired,
        completed: completedStepIds.has(s.id),
      })),
      progress: {
        id: fresh?.id,
        status: fresh?.status || 'NOT_STARTED',
        startedAt: fresh?.startedAt,
        completedAt: fresh?.completedAt,
        dismissedAt: fresh?.dismissedAt,
        requiredDone,
        totalRequired,
      },
    });
  }

  const pendingBanner = result.find(
    (w) =>
      w.isRequired &&
      w.progress.status !== 'COMPLETED' &&
      w.progress.status !== 'DISMISSED'
  );

  return NextResponse.json({
    isOrg: true,
    workflows: result,
    banner: pendingBanner
      ? {
          workflowId: pendingBanner.id,
          name: pendingBanner.name,
          slug: pendingBanner.slug,
          requiredDone: pendingBanner.progress.requiredDone,
          totalRequired: pendingBanner.progress.totalRequired,
          href: `/workflows?workflow=${pendingBanner.id}`,
        }
      : null,
  });
}
