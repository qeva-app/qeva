import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { audienceMatches, getOrCreateProgress, isOrgAccount } from '@/lib/workflows';

type Ctx = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
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
  });
  if (!workflow || !audienceMatches(workflow.audience, session.user.role)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (workflow.isRequired) {
    return NextResponse.json(
      { error: 'This workflow is required and cannot be dismissed' },
      { status: 400 }
    );
  }

  const progress = await getOrCreateProgress(workflow.id, session.user.id);
  const updated = await prisma.workflowProgress.update({
    where: { id: progress.id },
    data: {
      status: 'DISMISSED',
      dismissedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
