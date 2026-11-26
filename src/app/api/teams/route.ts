import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createTeam, getUserTeams } from '@/lib/team';
import { logAudit, AuditActions } from '@/lib/audit';
import { getActorOrganizationId } from '@/lib/org-access';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teams = await getUserTeams(session.user.id);
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  }

  // Always bind team to the caller's org - never trust client-supplied organizationId
  const organizationId = await getActorOrganizationId(session.user.id);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'An organization account is required to create teams' },
      { status: 403 }
    );
  }

  const team = await createTeam({
    name: body.name,
    description: body.description,
    isPrivate: body.isPrivate,
    icon: body.icon,
    color: body.color,
    label: body.label,
    createdBy: session.user.id,
    organizationId,
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.TEAM_CREATED,
    resource: 'team',
    details: { teamId: team.id, teamName: team.name },
    req,
  });

  try {
    const { syncWorkflowsForUser } = await import('@/lib/workflows');
    await syncWorkflowsForUser(session.user.id);
  } catch {
    /* non-blocking */
  }

  return NextResponse.json(team, { status: 201 });
}
