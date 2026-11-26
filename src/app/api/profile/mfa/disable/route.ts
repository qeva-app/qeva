import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { openMfaSecret, verifyTotp } from '@/lib/mfa';
import { logAudit, AuditActions } from '@/lib/audit';
import { checkRateLimit } from '@/lib/api';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(`mfa-disable:${session.user.id}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const { code, password } = await req.json();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user?.twoFactorEnabled) {
    return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
  }

  let ok = false;
  if (code && user.twoFactorSecret) {
    try {
      ok = verifyTotp(openMfaSecret(user.twoFactorSecret), code);
    } catch {
      ok = false;
    }
  }
  if (!ok && password && user.password) {
    ok = await bcrypt.compare(password, user.password);
  }
  if (!ok) {
    return NextResponse.json(
      { error: 'Provide a valid authenticator code or account password' },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.MFA_DISABLED,
    resource: 'mfa',
    details: {},
    req,
  });

  return NextResponse.json({ message: 'MFA disabled' });
}
