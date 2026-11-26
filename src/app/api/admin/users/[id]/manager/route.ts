import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { assertSameOrganization } from '@/lib/org-access';
import { getRbacActor } from '@/lib/rbac-access';
import { setUserManager } from '@/lib/org-chart';

async function handler(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgCheck = await assertSameOrganization(actor.userId, params.id);
  if (!orgCheck.ok) {
    return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
  }

  const body = await req.json().catch(() => ({}));
  const managerId =
    body.managerId === null || body.managerId === ''
      ? null
      : typeof body.managerId === 'string'
        ? body.managerId
        : undefined;

  if (managerId === undefined) {
    return NextResponse.json(
      { error: 'managerId is required (string or null to clear)' },
      { status: 400 }
    );
  }

  const result = await setUserManager({
    organizationId: orgCheck.organizationId,
    userId: params.id,
    managerId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logAudit({
    userId: actor.userId,
    action: AuditActions.USER_UPDATED,
    resource: 'user',
    details: { targetUserId: params.id, managerId },
    req,
  });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      managerId: true,
      manager: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(user);
}

export const PUT = withAuth(handler, 'USER:UPDATE');
