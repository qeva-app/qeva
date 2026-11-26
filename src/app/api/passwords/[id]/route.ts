import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { encrypt, encryptNotes } from '@/lib/encryption-unified';
import { getOrgEncryptionKey } from '@/lib/org-encryption';
import { calculatePasswordStrength } from '@/lib/password-strength';
import { passwordEntryUpdateSchema } from '@/lib/validation';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  getPasswordAccessContext,
  canViewPassword,
  canEditPassword,
  canDeletePassword,
  getTeamRole,
  toClientPassword,
} from '@/lib/password-access';
import { getPasswordPolicyForUser } from '@/lib/get-user-policy';
import { validatePasswordAgainstPolicy } from '@/lib/password-policy';

const entryInclude = {
  user: { select: { name: true, email: true, organizationId: true } },
  team: { select: { name: true, organizationId: true } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  const password = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: entryInclude,
  });

  if (!password) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!canViewPassword(password, ctx)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teamRole = password.teamId
    ? await getTeamRole(session.user.id, password.teamId)
    : null;
  // Metadata only - secrets via POST /reveal (or client DEK for USER_MASTER)
  const base = toClientPassword(password, ctx, teamRole);
  if (password.encryptionType === 'USER_MASTER') {
    return NextResponse.json({
      ...base,
      encryptionType: 'USER_MASTER',
      ciphertext: password.encryptedPassword,
      notesCiphertext: password.notes,
      decryptedPassword: '',
      notes: null,
    });
  }
  return NextResponse.json(base);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  const existing = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: entryInclude,
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teamRole = existing.teamId
    ? await getTeamRole(session.user.id, existing.teamId)
    : null;

  if (!canEditPassword(existing, ctx, teamRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = passwordEntryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.username !== undefined) updateData.username = data.username;
  if (data.website !== undefined) updateData.website = data.website || null;
  if (data.category !== undefined) updateData.category = data.category;
  // notes encrypted below once encryptionType/dek known
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.expiryDate !== undefined) {
    updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  }
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.label !== undefined) updateData.label = data.label;
  if (data.serviceId !== undefined) updateData.serviceId = data.serviceId || null;

  // Only the owner (or org admin on global) may flip personal↔global
  if (data.isGlobal !== undefined && !existing.isTeam) {
    if (data.isGlobal) {
      if (!ctx.canAccessGlobalVault) {
        return NextResponse.json(
          { error: 'Global vault unlocks after organization activation' },
          { status: 403 }
        );
      }
      updateData.isGlobal = true;
    } else if (existing.userId === session.user.id || ctx.role === 'ADMIN') {
      updateData.isGlobal = false;
    }
  }

  const keepMaster =
    existing.encryptionType === 'USER_MASTER' &&
    !existing.isGlobal &&
    !existing.isTeam &&
    updateData.isGlobal !== true &&
    data.clientEncrypted !== false;

  if (data.clientEncrypted && keepMaster && data.encryptedPassword) {
    updateData.encryptedPassword = data.encryptedPassword;
    updateData.encryptionType = 'USER_MASTER';
    if (data.strength != null) updateData.strength = data.strength;
    if (data.encryptedNotes !== undefined) updateData.notes = data.encryptedNotes;
    await prisma.passwordHistory.create({
      data: {
        passwordEntryId: params.id,
        encryptedPassword: existing.encryptedPassword,
        encryptionType: existing.encryptionType,
        strength: existing.strength,
        changedBy: session.user.id,
      },
    });
  } else if (data.password) {
    if (keepMaster) {
      return NextResponse.json(
        {
          error:
            'Unlock your vault and save with client encryption for master-key credentials',
        },
        { status: 400 }
      );
    }
    const policy = await getPasswordPolicyForUser(session.user.id);
    const policyCheck = validatePasswordAgainstPolicy(data.password, policy);
    if (!policyCheck.ok) {
      return NextResponse.json(
        { error: 'Password does not meet organization policy', details: policyCheck.errors },
        { status: 400 }
      );
    }
    const strength = calculatePasswordStrength(data.password).score;

    const isShared =
      existing.isTeam ||
      existing.isGlobal ||
      updateData.isGlobal === true;
    const orgId =
      existing.team?.organizationId ||
      existing.user?.organizationId ||
      ctx.organizationId;
    const orgKey = isShared && orgId ? getOrgEncryptionKey(orgId) : undefined;

    if (orgKey) {
      updateData.encryptedPassword = encrypt(data.password, orgKey);
      updateData.encryptionType = 'ORG_KEY';
    } else {
      updateData.encryptedPassword = encrypt(data.password);
      updateData.encryptionType = 'PUBLIC_KEY';
    }
    updateData.strength = strength;

    await prisma.passwordHistory.create({
      data: {
        passwordEntryId: params.id,
        encryptedPassword: existing.encryptedPassword,
        encryptionType: existing.encryptionType,
        strength: existing.strength,
        changedBy: session.user.id,
      },
    });
  }

  if (data.notes !== undefined && !data.clientEncrypted) {
    const encType =
      (updateData.encryptionType as string) || existing.encryptionType || 'PUBLIC_KEY';
    const orgId =
      existing.team?.organizationId ||
      existing.user?.organizationId ||
      ctx.organizationId;
    const orgKey =
      encType === 'ORG_KEY' && orgId ? getOrgEncryptionKey(orgId) : undefined;
    updateData.notes = encryptNotes(data.notes, orgKey);
  }

  const updated = await prisma.passwordEntry.update({
    where: { id: params.id },
    data: updateData,
    include: entryInclude,
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.PASSWORD_UPDATED,
    resource: 'password',
    details: { id: params.id, title: updated.title },
    req,
  });

  if (data.password || data.encryptedPassword) {
    void import('@/lib/webhooks').then(({ emitDomainEvent }) =>
      emitDomainEvent(
        'password.rotated',
        { id: params.id, title: updated.title },
        { userId: session.user.id, organizationId: session.user.organizationId }
      )
    );
  }

  return NextResponse.json(toClientPassword(updated, ctx, teamRole));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  const existing = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: entryInclude,
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teamRole = existing.teamId
    ? await getTeamRole(session.user.id, existing.teamId)
    : null;

  if (!canDeletePassword(existing, ctx, teamRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.passwordEntry.delete({ where: { id: params.id } });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.PASSWORD_DELETED,
    resource: 'password',
    details: { id: params.id, title: existing.title },
    req,
  });

  return NextResponse.json({ message: 'Password deleted' });
}
