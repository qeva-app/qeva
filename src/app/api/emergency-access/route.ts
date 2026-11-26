import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { sendRawEmail } from '@/lib/smtp';

async function activateIfDue(id: string, grantorId: string, waitingPeriod: number, requestedAt: Date | null) {
  if (!requestedAt) return null;
  const readyAt = requestedAt.getTime() + waitingPeriod * 60 * 60 * 1000;
  if (Date.now() < readyAt) return null;

  const updated = await prisma.emergencyAccess.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      approvedAt: new Date(),
      accessExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    userId: grantorId,
    action: AuditActions.EMERGENCY_ACCESS_ACTIVATED,
    resource: 'emergency_access',
    details: { emergencyAccessId: id },
  });

  return updated;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [grantedRaw, receivedRaw] = await Promise.all([
    prisma.emergencyAccess.findMany({
      where: { grantorId: session.user.id },
      include: { grantee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.emergencyAccess.findMany({
      where: { granteeId: session.user.id },
      include: { grantor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Auto-activate due requests on read
  const granted = await Promise.all(
    grantedRaw.map(async (row) => {
      if (row.status === 'REQUESTED') {
        const activated = await activateIfDue(row.id, row.grantorId, row.waitingPeriod, row.requestedAt);
        return activated ? { ...row, ...activated } : row;
      }
      return row;
    })
  );
  const received = await Promise.all(
    receivedRaw.map(async (row) => {
      if (row.status === 'REQUESTED') {
        const activated = await activateIfDue(row.id, row.grantorId, row.waitingPeriod, row.requestedAt);
        return activated ? { ...row, ...activated } : row;
      }
      return row;
    })
  );

  return NextResponse.json({ granted, received });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, granteeId, emergencyAccessId, waitingPeriod = 48 } = await req.json();
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, name: true, email: true },
  });

  switch (action) {
    case 'grant': {
      if (!granteeId) return NextResponse.json({ error: 'granteeId required' }, { status: 400 });
      if (granteeId === session.user.id) {
        return NextResponse.json({ error: 'Cannot grant to yourself' }, { status: 400 });
      }

      const grantee = await prisma.user.findUnique({
        where: { id: granteeId },
        select: { id: true, email: true, name: true, organizationId: true },
      });
      if (!grantee) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (
        me?.organizationId &&
        grantee.organizationId &&
        me.organizationId !== grantee.organizationId
      ) {
        return NextResponse.json({ error: 'Grantee must be in your organization' }, { status: 403 });
      }

      const existing = await prisma.emergencyAccess.findUnique({
        where: { grantorId_granteeId: { grantorId: session.user.id, granteeId } },
      });
      if (existing && existing.status !== 'REVOKED') {
        return NextResponse.json({ error: 'Already granted' }, { status: 409 });
      }

      const access = existing
        ? await prisma.emergencyAccess.update({
            where: { id: existing.id },
            data: {
              waitingPeriod: Math.min(720, Math.max(1, Number(waitingPeriod) || 48)),
              status: 'APPROVED',
              requestedAt: null,
              accessExpiresAt: null,
            },
          })
        : await prisma.emergencyAccess.create({
            data: {
              grantorId: session.user.id,
              granteeId,
              waitingPeriod: Math.min(720, Math.max(1, Number(waitingPeriod) || 48)),
              status: 'APPROVED',
            },
          });

      if (grantee.email) {
        try {
          await sendRawEmail(
            grantee.email,
            'Emergency Access Granted — Qeva',
            `${me?.name || 'A user'} has designated you as their emergency contact on Qeva.\n\nIf they become incapacitated, you can request access to their vault after a waiting period.\n\nNote: master-key (USER_MASTER) encrypted entries remain private.`
          );
        } catch { /* ignore */ }
      }

      await logAudit({
        userId: session.user.id,
        action: AuditActions.EMERGENCY_ACCESS_GRANTED,
        resource: 'emergency_access',
        details: { granteeId, waitingPeriod },
        req,
      });

      return NextResponse.json(access, { status: 201 });
    }

    case 'request': {
      if (!emergencyAccessId) {
        return NextResponse.json({ error: 'emergencyAccessId required' }, { status: 400 });
      }

      const access = await prisma.emergencyAccess.findFirst({
        where: { id: emergencyAccessId, granteeId: session.user.id, status: 'APPROVED' },
        include: { grantor: { select: { email: true, name: true } } },
      });
      if (!access) return NextResponse.json({ error: 'Not found or not approved' }, { status: 404 });

      const updated = await prisma.emergencyAccess.update({
        where: { id: emergencyAccessId },
        data: { status: 'REQUESTED', requestedAt: new Date() },
      });

      if (access.grantor.email) {
        try {
          await sendRawEmail(
            access.grantor.email,
            'Emergency Access Requested — Qeva',
            `${session.user.name || 'Someone'} has requested emergency access to your Qeva vault.\n\nIf you do not reject within ${access.waitingPeriod} hours, access will activate.\n\nReject in Settings → Emergency Access.`
          );
        } catch { /* ignore */ }
      }

      await logAudit({
        userId: session.user.id,
        action: AuditActions.EMERGENCY_ACCESS_REQUESTED,
        resource: 'emergency_access',
        details: { grantorId: access.grantorId, waitingPeriod: access.waitingPeriod },
        req,
      });

      void import('@/lib/webhooks').then(({ emitDomainEvent }) =>
        emitDomainEvent(
          'emergency.requested',
          { emergencyAccessId, grantorId: access.grantorId, waitingPeriod: access.waitingPeriod },
          { userId: access.grantorId, organizationId: session.user.organizationId }
        )
      );

      return NextResponse.json(updated);
    }

    case 'revoke': {
      if (!emergencyAccessId) {
        return NextResponse.json({ error: 'emergencyAccessId required' }, { status: 400 });
      }

      const owned = await prisma.emergencyAccess.findFirst({
        where: { id: emergencyAccessId, grantorId: session.user.id },
      });
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await prisma.emergencyAccess.update({
        where: { id: emergencyAccessId },
        data: { status: 'REVOKED', requestedAt: null, accessExpiresAt: null },
      });

      await logAudit({
        userId: session.user.id,
        action: AuditActions.EMERGENCY_ACCESS_REVOKED,
        resource: 'emergency_access',
        details: { emergencyAccessId },
        req,
      });

      return NextResponse.json({ message: 'Access revoked' });
    }

    case 'reject': {
      if (!emergencyAccessId) {
        return NextResponse.json({ error: 'emergencyAccessId required' }, { status: 400 });
      }

      const owned = await prisma.emergencyAccess.findFirst({
        where: { id: emergencyAccessId, grantorId: session.user.id, status: 'REQUESTED' },
      });
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await prisma.emergencyAccess.update({
        where: { id: emergencyAccessId },
        data: { status: 'APPROVED', requestedAt: null },
      });

      await logAudit({
        userId: session.user.id,
        action: AuditActions.EMERGENCY_ACCESS_REJECTED,
        resource: 'emergency_access',
        details: { emergencyAccessId },
        req,
      });

      return NextResponse.json({ message: 'Request rejected' });
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
