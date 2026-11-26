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
  getPasswordAccessContext,
  buildAccessibleWhere,
  assertTeamMembership,
  toClientPasswordList,
  toClientPassword,
} from '@/lib/password-access';
import { getPasswordPolicyForUser } from '@/lib/get-user-policy';
import { validatePasswordAgainstPolicy } from '@/lib/password-policy';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  const { searchParams } = req.nextUrl;
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const isGlobal = searchParams.get('isGlobal') === 'true';
  const teamId = searchParams.get('teamId');
  const favorites = searchParams.get('favorites') === 'true';
  const serviceId = searchParams.get('serviceId');

  const accessWhere = buildAccessibleWhere(ctx);
  const and: Record<string, unknown>[] = [accessWhere];

  if (isGlobal) {
    if (!ctx.canAccessGlobalVault) return NextResponse.json([]);
    and.push({ isGlobal: true });
  } else if (teamId) {
    if (!ctx.canAccessTeams) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const membership = await assertTeamMembership(session.user.id, teamId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    and.push({ isTeam: true, teamId });
  }

  if (category) and.push({ category });
  if (serviceId) and.push({ serviceId });
  if (favorites) and.push({ isFavorite: true, userId: session.user.id });

  if (search) {
    and.push({
      OR: [
        { title: { contains: search } },
        { username: { contains: search } },
        { website: { contains: search } },
        { tags: { contains: search } },
        { notes: { contains: search } },
        { label: { contains: search } },
      ],
    });
  }

  const passwords = await prisma.passwordEntry.findMany({
    where: { AND: and },
    orderBy: [{ isFavorite: 'desc' }, { title: 'asc' }],
    include: {
      user: { select: { name: true, email: true, organizationId: true } },
      team: { select: { name: true, organizationId: true } },
    },
  });

  const teamRoles = new Map<string, string>();
  if (ctx.teamIds.length > 0) {
    const memberships = await prisma.teamMembership.findMany({
      where: { userId: session.user.id, isActive: true, teamId: { in: ctx.teamIds } },
      select: { teamId: true, role: true },
    });
    for (const m of memberships) teamRoles.set(m.teamId, m.role);
  }

  return NextResponse.json(toClientPasswordList(passwords, ctx, teamRoles));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = passwordEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // shortcut: client-sealed USER_MASTER skips server policy check (plaintext never sent)
    if (data.password) {
      const policy = await getPasswordPolicyForUser(session.user.id);
      const policyCheck = validatePasswordAgainstPolicy(data.password, policy);
      if (!policyCheck.ok) {
        return NextResponse.json(
          { error: 'Password does not meet organization policy', details: policyCheck.errors },
          { status: 400 }
        );
      }
    }

    const ctx = await getPasswordAccessContext(session.user.id, session.user.role);

    let isGlobal = !!data.isGlobal;
    let isTeam = !!data.isTeam;
    let teamId = data.teamId || null;

    if (isGlobal && isTeam) {
      return NextResponse.json(
        { error: 'A password cannot be both global and team-scoped' },
        { status: 400 }
      );
    }

    if (isGlobal) {
      if (!ctx.canAccessGlobalVault) {
        return NextResponse.json(
          { error: 'Global vault unlocks after organization activation' },
          { status: 403 }
        );
      }
      teamId = null;
      isTeam = false;
    }

    if (isTeam || teamId) {
      if (!ctx.canAccessTeams) {
        return NextResponse.json(
          { error: 'Teams unlock after organization activation' },
          { status: 403 }
        );
      }
      if (!teamId) {
        return NextResponse.json({ error: 'teamId is required for team passwords' }, { status: 400 });
      }
      const membership = await assertTeamMembership(session.user.id, teamId);
      if (!membership) {
        return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
      }
      isTeam = true;
      isGlobal = false;
    } else {
      isTeam = false;
      teamId = null;
    }

    const useOrgKey = (isGlobal || isTeam) && !!ctx.organizationId;
    const orgKey = useOrgKey ? getOrgEncryptionKey(ctx.organizationId!) : undefined;

    // Client-sealed USER_MASTER - server never sees plaintext
    if (
      data.clientEncrypted &&
      data.encryptionType === 'USER_MASTER' &&
      data.encryptedPassword &&
      !isGlobal &&
      !isTeam
    ) {
      const passwordEntry = await prisma.passwordEntry.create({
        data: {
          title: data.title,
          username: data.username,
          encryptedPassword: data.encryptedPassword,
          website: data.website || undefined,
          category: data.category,
          notes: data.encryptedNotes || undefined,
          tags: data.tags,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          strength: data.strength ?? 0,
          icon: data.icon,
          color: data.color,
          label: data.label,
          isGlobal: false,
          isTeam: false,
          encryptionType: 'USER_MASTER',
          userId: session.user.id,
          serviceId: data.serviceId || undefined,
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
        details: { title: data.title, category: data.category, clientEncrypted: true },
        req,
      });

      void import('@/lib/webhooks').then(({ emitDomainEvent }) =>
        emitDomainEvent(
          'password.created',
          { id: passwordEntry.id, title: data.title },
          { userId: session.user.id, organizationId: session.user.organizationId }
        )
      );

      return NextResponse.json(toClientPassword(passwordEntry, ctx), { status: 201 });
    }

    if (!data.password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const strength = calculatePasswordStrength(data.password).score;
    const encryptionType = useOrgKey ? 'ORG_KEY' : 'PUBLIC_KEY';
    const encryptedPassword = encrypt(data.password, orgKey);
    const notes = encryptNotes(data.notes, orgKey);

    const passwordEntry = await prisma.passwordEntry.create({
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
        isGlobal,
        isTeam,
        teamId: teamId || undefined,
        encryptionType,
        userId: session.user.id,
        serviceId: data.serviceId || undefined,
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
      details: { title: data.title, category: data.category, isGlobal, isTeam, teamId },
      req,
    });

    void import('@/lib/webhooks').then(({ emitDomainEvent }) =>
      emitDomainEvent(
        'password.created',
        { id: passwordEntry.id, title: data.title },
        { userId: session.user.id, organizationId: session.user.organizationId }
      )
    );

    try {
      const { syncWorkflowsForUser } = await import('@/lib/workflows');
      await syncWorkflowsForUser(session.user.id);
    } catch {
      /* non-blocking */
    }

    return NextResponse.json(toClientPassword(passwordEntry, ctx), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create password' }, { status: 500 });
  }
}
