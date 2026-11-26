import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { assertTeamMembership, canManageTeam, getTeamRole } from '@/lib/team';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await assertTeamMembership(session.user.id, params.id);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      memberships: {
        where: { isActive: true },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      _count: { select: { passwords: true } },
    },
  });

  if (!team || !team.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...team, myRole: membership.role });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getTeamRole(session.user.id, params.id);
  if (!role || !canManageTeam(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const team = await prisma.team.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isPrivate !== undefined ? { isPrivate: !!body.isPrivate } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.TEAM_UPDATED,
    resource: 'team',
    details: { teamId: params.id, teamName: team.name },
    req,
  });

  return NextResponse.json(team);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getTeamRole(session.user.id, params.id);
  if (role !== 'OWNER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only the team owner can delete this team' }, { status: 403 });
  }

  await prisma.team.update({ where: { id: params.id }, data: { isActive: false } });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.TEAM_DELETED,
    resource: 'team',
    details: { teamId: params.id },
    req,
  });

  return NextResponse.json({ message: 'Team deleted' });
}
