import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { assertSameOrganization } from '@/lib/org-access';
import { assertAssignableRole, getRbacActor } from '@/lib/rbac-access';
import cache from '@/lib/cache';

async function handler(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (params.id === actor.userId) {
    return NextResponse.json(
      { error: 'You cannot change your own role' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { roleId } = body;
  if (!roleId || typeof roleId !== 'string') {
    return NextResponse.json({ error: 'roleId is required' }, { status: 400 });
  }

  const orgCheck = await assertSameOrganization(actor.userId, params.id);
  if (!orgCheck.ok) {
    // Super Admin may assign within target's org even if not a member
    if (!actor.isSuperAdmin) {
      return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
    }
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    });
    if (!target?.organizationId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 });
    }
    const assignable = await assertAssignableRole(actor, roleId, target.organizationId);
    if (!assignable.ok) {
      return NextResponse.json({ error: assignable.error }, { status: assignable.status });
    }
  } else {
    const assignable = await assertAssignableRole(actor, roleId, orgCheck.organizationId);
    if (!assignable.ok) {
      return NextResponse.json({ error: assignable.error }, { status: assignable.status });
    }
  }

  await prisma.userRoleAssignment.updateMany({
    where: { userId: params.id, isPrimary: true },
    data: { isPrimary: false },
  });

  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: params.id, roleId } },
    update: { isPrimary: true, isActive: true, assignedBy: actor.userId },
    create: {
      userId: params.id,
      roleId,
      isPrimary: true,
      isActive: true,
      assignedBy: actor.userId,
    },
  });

  cache.clear();

  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });

  await logAudit({
    userId: actor.userId,
    action: AuditActions.USER_ROLE_ASSIGNED,
    resource: 'user_role',
    details: { targetUserId: params.id, roleId, roleName: role?.name },
    req,
  });

  return NextResponse.json({
    message: 'Role assigned',
    role: role?.name,
    note: 'User must sign in again for the new role to appear in their session',
  });
}

export const POST = withAuth(handler, 'ROLE:MANAGE');
