import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { withAuth } from '@/lib/auth-middleware';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { getActorOrganizationId } from '@/lib/org-access';
import { assertAssignableRole, getRbacActor } from '@/lib/rbac-access';
import { setUserManager } from '@/lib/org-chart';
import { sendInviteEmail } from '@/lib/smtp';
import { createInviteToken, inviteActivationUrl } from '@/lib/invite-token';
import { logAudit, AuditActions } from '@/lib/audit';
import logger from '@/lib/logger';
import { allowsCompanyAccounts } from '@/lib/edition';

async function handleGet(req: NextRequest) {
  if (!allowsCompanyAccounts()) {
    return NextResponse.json(
      { error: 'Organization features require Qeva Enterprise' },
      { status: 403 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = await getActorOrganizationId(session.user.id);
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search');
  const where: Record<string, unknown> = { organizationId };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { username: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      isActive: true,
      isVerified: true, // pending invite when false
      department: true,
      position: true,
      jobTitle: true,
      image: true,
      createdAt: true,
      encryptionEnabled: true,
      managerId: true,
      manager: { select: { id: true, name: true, email: true } },
      userRoles: {
        where: { isActive: true, isPrimary: true },
        include: { role: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = users.map((u) => ({
    ...u,
    role: u.userRoles[0]?.role?.name || 'USER',
    userRoles: undefined,
  }));

  return NextResponse.json(result);
}

async function handlePost(req: NextRequest) {
  if (!allowsCompanyAccounts()) {
    return NextResponse.json(
      { error: 'Organization features require Qeva Enterprise' },
      { status: 403 }
    );
  }

  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId =
    actor.organizationId || (await getActorOrganizationId(actor.userId));
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const roleId = typeof body.roleId === 'string' ? body.roleId : '';

  /** Local-part only - domain is always the org's (ignore any typed @domain). */
  const toLocal = (raw: unknown) => {
    if (typeof raw !== 'string') return '';
    return raw
      .trim()
      .toLowerCase()
      .split('@')[0]
      .replace(/[^a-z0-9._+-]/g, '');
  };

  const emailLocal = toLocal(body.emailLocal ?? body.email);
  const managerLocal = toLocal(body.managerEmailLocal ?? body.managerEmail);

  if (!emailLocal) {
    return NextResponse.json({ error: 'Email username is required' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!roleId) {
    return NextResponse.json({ error: 'Role is required' }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, domain: true },
  });
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  let domain = org.domain?.toLowerCase() || null;
  if (!domain) {
    const actorUser = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { email: true },
    });
    domain = actorUser?.email.split('@')[1]?.toLowerCase() || null;
  }
  if (!domain) {
    return NextResponse.json(
      { error: 'Organization domain is not configured' },
      { status: 400 }
    );
  }

  // Persist domain on org if it was only inferred
  if (!org.domain) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { domain },
    });
  }

  const email = `${emailLocal}@${domain}`;
  const managerEmail = managerLocal ? `${managerLocal}@${domain}` : '';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 }
    );
  }

  const assignable = await assertAssignableRole(actor, roleId, organizationId);
  if (!assignable.ok) {
    return NextResponse.json({ error: assignable.error }, { status: assignable.status });
  }

  let managerId: string | null = null;
  if (managerEmail) {
    const manager = await prisma.user.findFirst({
      where: {
        email: managerEmail,
        organizationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!manager) {
      return NextResponse.json(
        { error: 'Manager email not found in your organization' },
        { status: 400 }
      );
    }
    managerId = manager.id;
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true },
  });
  if (!role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  const parts = name.split(/\s+/);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(' ') || null;

  let username = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || 'user';
  const usernameTaken = await prisma.user.findUnique({ where: { username } });
  if (usernameTaken) {
    username = `${username}_${crypto.randomBytes(3).toString('hex')}`;
  }

  const invite = createInviteToken();
  const activateUrl = inviteActivationUrl(email, invite.token);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      name,
      firstName,
      lastName,
      password: null,
      isActive: true,
      isVerified: false,
      accountType: 'ORGANIZATION',
      organizationId,
      managerId: null,
      otp: invite.tokenHash,
      otpExpiry: invite.expiresAt,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      manager: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.userRoleAssignment.create({
    data: {
      userId: user.id,
      roleId: role.id,
      isPrimary: true,
      isActive: true,
      assignedBy: actor.userId,
    },
  });

  if (managerId) {
    const mgr = await setUserManager({
      organizationId,
      userId: user.id,
      managerId,
    });
    if (!mgr.ok) {
      logger.warn('Invite manager assign failed', { userId: user.id, error: mgr.error });
    }
  }

  try {
    await sendInviteEmail({
      to: email,
      name,
      orgName: org.name,
      roleName: role.name,
      activateUrl,
    });
  } catch (e) {
    logger.error('Invite email failed - rolling back user', { email, error: e });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    return NextResponse.json(
      {
        error:
          'Could not send the invite email. Check email settings and try again. No account was kept.',
      },
      { status: 503 }
    );
  }

  await logAudit({
    userId: actor.userId,
    action: AuditActions.USER_CREATED,
    resource: 'user',
    details: {
      invitedUserId: user.id,
      email,
      roleId: role.id,
      roleName: role.name,
      managerId,
      emailSent: true,
      via: 'invite',
    },
    req,
  });

  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      manager: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(
    {
      ...refreshed,
      role: role.name,
      emailSent: true,
      message: `Invite sent to ${email}`,
    },
    { status: 201 }
  );
}

export const GET = withAuth(handleGet, 'USER:UPDATE');
export const POST = withAuth(handlePost, 'USER:CREATE');
