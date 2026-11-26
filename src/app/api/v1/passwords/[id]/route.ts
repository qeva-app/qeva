import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption-unified';
import { calculatePasswordStrength } from '@/lib/password-strength';
import {
  getPasswordAccessContext,
  canViewPassword,
  canEditPassword,
  canDeletePassword,
  getTeamRole,
  toClientPassword,
} from '@/lib/password-access';
import { passwordEntryUpdateSchema } from '@/lib/validation';
import { logAudit, AuditActions } from '@/lib/audit';
import { auditClient, isV1Auth, requireV1Auth } from '@/lib/v1-auth';

const entryInclude = {
  user: { select: { name: true, email: true, organizationId: true } },
  team: { select: { name: true, organizationId: true } },
} as const;

type RouteCtx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const auth = await requireV1Auth(req, 'passwords:read');
  if (!isV1Auth(auth)) return auth;

  const ctx = await getPasswordAccessContext(auth.userId, 'USER');
  const password = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: entryInclude,
  });

  if (!password || !canViewPassword(password, ctx)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teamRole = password.teamId
    ? await getTeamRole(auth.userId, password.teamId)
    : null;
  const base = toClientPassword(password, ctx, teamRole, { includeSecret: true });

  await logAudit({
    userId: auth.userId,
    action: AuditActions.PASSWORD_VIEWED,
    resource: 'password',
    details: { passwordId: password.id, title: password.title, via: 'api_v1', ...auditClient(auth) },
    req,
  });

  return NextResponse.json({
    id: base.id,
    title: base.title,
    username: base.username,
    website: base.website,
    password:
      base.encryptionType !== 'USER_MASTER' ? base.decryptedPassword || null : null,
    locked: base.encryptionType === 'USER_MASTER' ? true : !!base.locked,
    encryptionType: base.encryptionType,
    clientKind: auth.clientKind,
  });
}

export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const auth = await requireV1Auth(req, 'passwords:write');
  if (!isV1Auth(auth)) return auth;

  const ctx = await getPasswordAccessContext(auth.userId, 'USER');
  const existing = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: entryInclude,
  });

  if (!existing || !canViewPassword(existing, ctx)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teamRole = existing.teamId
    ? await getTeamRole(auth.userId, existing.teamId)
    : null;

  if (!canEditPassword(existing, ctx, teamRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (existing.encryptionType === 'USER_MASTER') {
    return NextResponse.json(
      { error: 'USER_MASTER entries cannot be updated via API (unlock in the web app)' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = passwordEntryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.username !== undefined) updateData.username = data.username;
  if (data.website !== undefined) updateData.website = data.website || null;

  if (data.password) {
    updateData.encryptedPassword = encrypt(data.password);
    updateData.encryptionType = 'PUBLIC_KEY';
    updateData.strength = calculatePasswordStrength(data.password).score;
    await prisma.passwordHistory.create({
      data: {
        passwordEntryId: params.id,
        encryptedPassword: existing.encryptedPassword,
        encryptionType: existing.encryptionType,
        strength: existing.strength,
        changedBy: auth.userId,
      },
    });
  }

  const updated = await prisma.passwordEntry.update({
    where: { id: params.id },
    data: updateData,
    include: entryInclude,
  });

  await logAudit({
    userId: auth.userId,
    action: AuditActions.PASSWORD_UPDATED,
    resource: 'password',
    details: { passwordId: params.id, title: updated.title, via: 'api_v1', ...auditClient(auth) },
    req,
  });

  const out = toClientPassword(updated, ctx, teamRole, { includeSecret: true });
  return NextResponse.json({
    id: out.id,
    title: out.title,
    username: out.username,
    website: out.website,
    password: out.decryptedPassword || null,
    encryptionType: out.encryptionType,
    clientKind: auth.clientKind,
  });
}

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  const auth = await requireV1Auth(req, 'passwords:write');
  if (!isV1Auth(auth)) return auth;

  const ctx = await getPasswordAccessContext(auth.userId, 'USER');
  const existing = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: entryInclude,
  });

  if (!existing || !canViewPassword(existing, ctx)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teamRole = existing.teamId
    ? await getTeamRole(auth.userId, existing.teamId)
    : null;

  if (!canDeletePassword(existing, ctx, teamRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.passwordEntry.delete({ where: { id: params.id } });

  await logAudit({
    userId: auth.userId,
    action: AuditActions.PASSWORD_DELETED,
    resource: 'password',
    details: { passwordId: params.id, title: existing.title, via: 'api_v1', ...auditClient(auth) },
    req,
  });

  return NextResponse.json({ ok: true, clientKind: auth.clientKind });
}
