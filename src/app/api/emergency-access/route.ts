import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { sendRawEmail } from '@/lib/smtp';

const DEFAULT_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

/** Keep grant-time planned end if still in the future; otherwise default 7 days. */
function resolveAccessExpiresAt(planned: Date | null | undefined): Date {
  if (planned && planned.getTime() > Date.now()) return planned;
  return new Date(Date.now() + DEFAULT_ACTIVE_MS);
}

function parseFutureExpiresAt(raw: unknown): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string' && !(raw instanceof Date)) {
    return { ok: false, error: 'Invalid access end datetime' };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid access end datetime' };
  if (d.getTime() <= Date.now()) {
    return { ok: false, error: 'Access end must be a future date and time' };
  }
  return { ok: true, value: d };
}

type ActivateRow = {
  id: string;
  grantorId: string;
  status: string;
  waitingPeriod: number;
  requestedAt: Date | null;
  createdAt: Date;
  accessExpiresAt: Date | null;
};

/**
 * Waiting starts when access is granted (createdAt), unless a legacy REQUESTED
 * row set requestedAt. No separate "request" click required.
 */
async function activateIfDue(row: ActivateRow) {
  if (row.status !== 'APPROVED' && row.status !== 'REQUESTED') return null;
  const start = row.requestedAt ?? row.createdAt;
  const readyAt = start.getTime() + row.waitingPeriod * 60 * 60 * 1000;
  if (Date.now() < readyAt) return null;

  const updated = await prisma.emergencyAccess.update({
    where: { id: row.id },
    data: {
      status: 'ACTIVE',
      approvedAt: new Date(),
      accessExpiresAt: resolveAccessExpiresAt(row.accessExpiresAt),
    },
  });

  await logAudit({
    userId: row.grantorId,
    action: AuditActions.EMERGENCY_ACCESS_ACTIVATED,
    resource: 'emergency_access',
    details: { emergencyAccessId: row.id },
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

  const granted = await Promise.all(
    grantedRaw.map(async (row) => {
      const activated = await activateIfDue(row);
      return activated ? { ...row, ...activated } : row;
    })
  );
  const received = await Promise.all(
    receivedRaw.map(async (row) => {
      const activated = await activateIfDue(row);
      return activated ? { ...row, ...activated } : row;
    })
  );

  return NextResponse.json({ granted, received });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, granteeId, emergencyAccessId, waitingPeriod = 48 } = body;
  const granteeEmail =
    typeof body.granteeEmail === 'string' ? body.granteeEmail.trim().toLowerCase() : '';
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, name: true, email: true },
  });

  switch (action) {
    case 'grant': {
      let resolvedId = typeof granteeId === 'string' ? granteeId : '';
      if (!resolvedId && granteeEmail) {
        const byEmail = await prisma.user.findUnique({
          where: { email: granteeEmail },
          select: { id: true },
        });
        if (!byEmail) {
          return NextResponse.json({ error: 'No Qeva account with that email' }, { status: 404 });
        }
        resolvedId = byEmail.id;
      }
      if (!resolvedId) {
        return NextResponse.json({ error: 'granteeId or granteeEmail required' }, { status: 400 });
      }
      if (resolvedId === session.user.id) {
        return NextResponse.json({ error: 'Cannot grant to yourself' }, { status: 400 });
      }

      const expiresParsed = parseFutureExpiresAt(body.accessExpiresAt);
      if (!expiresParsed.ok) {
        return NextResponse.json({ error: expiresParsed.error }, { status: 400 });
      }

      const grantee = await prisma.user.findUnique({
        where: { id: resolvedId },
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
        where: { grantorId_granteeId: { grantorId: session.user.id, granteeId: resolvedId } },
      });
      if (existing && existing.status !== 'REVOKED') {
        return NextResponse.json({ error: 'Already granted' }, { status: 409 });
      }

      // 0 allowed (immediate unlock after grant); waiting starts at grant time
      const waitHours = Math.min(720, Math.max(0, Number(waitingPeriod) || 0));
      const access = existing
        ? await prisma.emergencyAccess.update({
            where: { id: existing.id },
            data: {
              waitingPeriod: waitHours,
              status: 'APPROVED',
              requestedAt: null,
              accessExpiresAt: expiresParsed.value,
            },
          })
        : await prisma.emergencyAccess.create({
            data: {
              grantorId: session.user.id,
              granteeId: resolvedId,
              waitingPeriod: waitHours,
              status: 'APPROVED',
              accessExpiresAt: expiresParsed.value,
            },
          });

      if (grantee.email) {
        try {
          await sendRawEmail(
            grantee.email,
            'Emergency Access Granted - Qeva',
            `${me?.name || 'A user'} granted you emergency access to their Qeva vault.\n\nAfter the waiting period (${waitHours}h from grant), you can open their personal server-encrypted passwords in Settings → Emergency Access.\n\nNote: master-key (USER_MASTER) encrypted entries remain private.`
          );
        } catch { /* ignore */ }
      }

      await logAudit({
        userId: session.user.id,
        action: AuditActions.EMERGENCY_ACCESS_GRANTED,
        resource: 'emergency_access',
        details: {
          granteeId: resolvedId,
          waitingPeriod: waitHours,
          accessExpiresAt: expiresParsed.value?.toISOString() ?? null,
        },
        req,
      });

      return NextResponse.json(access, { status: 201 });
    }

    // Kept for older clients; waiting now starts at grant, so this is a no-op activate check
    case 'request': {
      if (!emergencyAccessId) {
        return NextResponse.json({ error: 'emergencyAccessId required' }, { status: 400 });
      }

      const access = await prisma.emergencyAccess.findFirst({
        where: { id: emergencyAccessId, granteeId: session.user.id },
      });
      if (!access || (access.status !== 'APPROVED' && access.status !== 'REQUESTED')) {
        return NextResponse.json({ error: 'Not found or not granted' }, { status: 404 });
      }

      const activated = await activateIfDue(access);
      return NextResponse.json(activated ?? access);
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
      // Cancel pending unlock (waiting since grant or legacy REQUESTED)
      if (!emergencyAccessId) {
        return NextResponse.json({ error: 'emergencyAccessId required' }, { status: 400 });
      }

      const owned = await prisma.emergencyAccess.findFirst({
        where: {
          id: emergencyAccessId,
          grantorId: session.user.id,
          status: { in: ['APPROVED', 'REQUESTED'] },
        },
      });
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await prisma.emergencyAccess.update({
        where: { id: emergencyAccessId },
        data: { status: 'REVOKED', requestedAt: null, accessExpiresAt: null },
      });

      await logAudit({
        userId: session.user.id,
        action: AuditActions.EMERGENCY_ACCESS_REJECTED,
        resource: 'emergency_access',
        details: { emergencyAccessId },
        req,
      });

      return NextResponse.json({ message: 'Access cancelled' });
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
