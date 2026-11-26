import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  getPasswordAccessContext,
  canViewPassword,
  getTeamRole,
  toClientPassword,
} from '@/lib/password-access';
import { checkRateLimit } from '@/lib/api';

/** Decrypt a single vault entry on demand - USER_MASTER returns ciphertext for client decrypt. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(`reveal:${session.user.id}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many reveal requests' }, { status: 429 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  const password = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true, email: true, organizationId: true } },
      team: { select: { name: true, organizationId: true } },
    },
  });

  if (!password || !canViewPassword(password, ctx)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const teamRole = password.teamId
    ? await getTeamRole(session.user.id, password.teamId)
    : null;

  await logAudit({
    userId: session.user.id,
    action: AuditActions.PASSWORD_VIEWED,
    resource: 'password',
    details: { id: params.id, title: password.title, via: 'reveal' },
    req,
  });

  if (password.encryptionType === 'USER_MASTER') {
    return NextResponse.json({
      id: password.id,
      encryptionType: 'USER_MASTER',
      ciphertext: password.encryptedPassword,
      notesCiphertext: password.notes,
      locked: false,
      decryptedPassword: '',
      notes: null,
    });
  }

  const client = toClientPassword(password, ctx, teamRole, { includeSecret: true });
  return NextResponse.json({
    id: client.id,
    decryptedPassword: client.decryptedPassword,
    notes: client.notes,
    locked: client.locked,
    encryptionType: client.encryptionType,
  });
}
