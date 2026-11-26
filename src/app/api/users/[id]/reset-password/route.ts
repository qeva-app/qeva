import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { withAuth } from '@/lib/auth-middleware';
import { authOptions, revokeUserSessions } from '@/lib/auth';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { assertSameOrganization } from '@/lib/org-access';
import { logAudit, AuditActions } from '@/lib/audit';

async function handler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgCheck = await assertSameOrganization(session.user.id, params.id);
  if (!orgCheck.ok) {
    return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
  }

  const tempPassword = crypto.randomBytes(12).toString('base64url');
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const hash = await bcrypt.hash(tempPassword, rounds);

  await prisma.user.update({
    where: { id: params.id },
    data: { password: hash },
  });

  revokeUserSessions(params.id);
  await prisma.userSession.updateMany({
    where: { userId: params.id, isActive: true },
    data: { isActive: false, logoutAt: new Date() },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.USER_PASSWORD_RESET_ADMIN,
    resource: 'user',
    details: { targetUserId: params.id, via: 'admin_reset' },
    req,
  });

  // Returned once to the authorized admin/manager in the same org - not logged.
  return NextResponse.json({
    message: 'Password reset. Share the temporary password securely; it will not be shown again.',
    tempPassword,
  });
}

export const POST = withAuth(handler, 'USER:UPDATE');
