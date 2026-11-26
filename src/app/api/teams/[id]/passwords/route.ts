import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { encrypt, encryptNotes } from '@/lib/encryption-unified';
import { getOrgEncryptionKey } from '@/lib/org-encryption';
import { calculatePasswordStrength } from '@/lib/password-strength';
import { passwordEntrySchema } from '@/lib/validation';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  assertTeamMembership,
  getPasswordAccessContext,
  toClientPasswordList,
  toClientPassword,
} from '@/lib/password-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await assertTeamMembership(session.user.id, params.id);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  if (!ctx.canAccessTeams) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const passwords = await prisma.passwordEntry.findMany({
    where: { teamId: params.id, isTeam: true },
    orderBy: { title: 'asc' },
    include: {
      user: { select: { name: true, email: true, organizationId: true } },
      team: { select: { name: true, organizationId: true } },
    },
  });

  const teamRoles = new Map([[params.id, membership.role]]);
  return NextResponse.json(toClientPasswordList(passwords, ctx, teamRoles));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await assertTeamMembership(session.user.id, params.id);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // VIEWER cannot add team passwords
  if (membership.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  if (!ctx.canAccessTeams) {
    return NextResponse.json(
      { error: 'Teams unlock after organization activation' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = passwordEntrySchema.safeParse({
      ...body,
      isTeam: true,
      teamId: params.id,
      isGlobal: false,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (!data.password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    const strength = calculatePasswordStrength(data.password).score;
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    });
    const orgKey = team?.organizationId
      ? getOrgEncryptionKey(team.organizationId)
      : undefined;
    const encryptionType = orgKey ? 'ORG_KEY' : 'PUBLIC_KEY';
    const encryptedPassword = encrypt(data.password, orgKey);
    const notes = encryptNotes(data.notes, orgKey);

    const entry = await prisma.passwordEntry.create({
      data: {
        title: data.title,
        username: data.username,
        encryptedPassword,
        website: data.website || undefined,
        category: data.category,
        notes: notes ?? undefined,
        tags: data.tags,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        strength,
        icon: data.icon,
        color: data.color,
        label: data.label,
        isTeam: true,
        isGlobal: false,
        teamId: params.id,
        encryptionType,
        userId: session.user.id,
      },
      include: {
        user: { select: { name: true, email: true, organizationId: true } },
        team: { select: { name: true, organizationId: true } },
      },
    });

    await logAudit({
      userId: session.user.id,
      action: AuditActions.PASSWORD_CREATED,
      resource: 'password',
      details: { title: data.title, teamId: params.id, isTeam: true },
      req,
    });

    return NextResponse.json(
      toClientPassword(entry, ctx, membership.role),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to create password' }, { status: 500 });
  }
}
