import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  assertTeamMembership,
  canManageTeam,
  getTeamRole,
} from '@/lib/team';
import { logAudit, AuditActions } from '@/lib/audit';
import { assertSameOrganization } from '@/lib/org-access';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await assertTeamMembership(session.user.id, params.id);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await getTeamMembers(params.id);
  return NextResponse.json(members);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getTeamRole(session.user.id, params.id);
  if (!role || !canManageTeam(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, role: memberRole } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const orgCheck = await assertSameOrganization(session.user.id, userId);
  if (!orgCheck.ok) {
    return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
  }

  const allowedRoles = ['MEMBER', 'ADMIN', 'OWNER'];
  const nextRole = allowedRoles.includes(memberRole) ? memberRole : 'MEMBER';
  // Only OWNER can grant OWNER
  if (nextRole === 'OWNER' && role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the owner can assign OWNER' }, { status: 403 });
  }

  const membership = await addTeamMember(params.id, userId, nextRole, session.user.id);

  await logAudit({
    userId: session.user.id,
    action: AuditActions.TEAM_MEMBER_ADDED,
    resource: 'team_member',
    details: { teamId: params.id, addedUserId: userId, role: nextRole },
    req,
  });

  try {
    const { syncWorkflowsForUser } = await import('@/lib/workflows');
    await syncWorkflowsForUser(userId);
  } catch {
    /* non-blocking */
  }

  return NextResponse.json(membership, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getTeamRole(session.user.id, params.id);
  if (!role || !canManageTeam(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await removeTeamMember(params.id, userId);

  await logAudit({
    userId: session.user.id,
    action: AuditActions.TEAM_MEMBER_REMOVED,
    resource: 'team_member',
    details: { teamId: params.id, removedUserId: userId },
    req,
  });

  return NextResponse.json({ message: 'Member removed' });
}
