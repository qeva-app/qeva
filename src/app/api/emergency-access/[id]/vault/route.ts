import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { toClientPasswordList } from '@/lib/password-access';
import { logAudit, AuditActions } from '@/lib/audit';

const DEFAULT_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

function resolveAccessExpiresAt(planned: Date | null | undefined): Date {
  if (planned && planned.getTime() > Date.now()) return planned;
  return new Date(Date.now() + DEFAULT_ACTIVE_MS);
}

/** List grantor's personal PUBLIC_KEY passwords when emergency access is ACTIVE. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let access = await prisma.emergencyAccess.findFirst({
    where: { id: params.id, granteeId: session.user.id },
    include: { grantor: { select: { id: true, name: true, email: true } } },
  });

  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Waiting starts at grant (createdAt); legacy REQUESTED uses requestedAt
  if (access.status === 'APPROVED' || access.status === 'REQUESTED') {
    const start = access.requestedAt ?? access.createdAt;
    const ready = start.getTime() + access.waitingPeriod * 60 * 60 * 1000 <= Date.now();
    if (ready) {
      access = await prisma.emergencyAccess.update({
        where: { id: access.id },
        data: {
          status: 'ACTIVE',
          approvedAt: new Date(),
          accessExpiresAt: resolveAccessExpiresAt(access.accessExpiresAt),
        },
        include: { grantor: { select: { id: true, name: true, email: true } } },
      });
      await logAudit({
        userId: access.grantorId,
        action: AuditActions.EMERGENCY_ACCESS_ACTIVATED,
        resource: 'emergency_access',
        details: { emergencyAccessId: access.id, via: 'vault_read' },
        req,
      });
    }
  }

  if (access.status !== 'ACTIVE') {
    const start = access.requestedAt ?? access.createdAt;
    const hours = Math.max(
      0,
      Math.ceil((start.getTime() + access.waitingPeriod * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000))
    );
    return NextResponse.json(
      {
        error:
          hours > 0
            ? `Emergency access is not active yet. About ${hours}h remaining in the waiting period.`
            : 'Emergency access is not active',
      },
      { status: 403 }
    );
  }

  if (access.accessExpiresAt && access.accessExpiresAt < new Date()) {
    await prisma.emergencyAccess.update({
      where: { id: access.id },
      data: { status: 'REVOKED' },
    });
    return NextResponse.json({ error: 'Emergency access expired' }, { status: 403 });
  }

  const passwords = await prisma.passwordEntry.findMany({
    where: {
      userId: access.grantorId,
      isGlobal: false,
      isTeam: false,
      encryptionType: 'PUBLIC_KEY',
    },
    orderBy: { title: 'asc' },
    include: {
      user: { select: { name: true, email: true, organizationId: true } },
      team: { select: { name: true, organizationId: true } },
    },
  });

  await logAudit({
    userId: access.grantorId,
    action: AuditActions.PASSWORD_VIEWED,
    resource: 'emergency_vault',
    details: {
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      actorName: session.user.name ?? null,
      count: passwords.length,
      emergencyAccessId: access.id,
    },
    req,
  });

  return NextResponse.json({
    grantor: access.grantor,
    accessExpiresAt: access.accessExpiresAt,
    note: 'Only personal server-encrypted credentials are available. Zero-knowledge entries are excluded.',
    // shortcut: emergency dump includes secrets; short-lived privileged access only
    passwords: toClientPasswordList(passwords, undefined, undefined, {
      includeSecret: true,
    }),
  });
}
