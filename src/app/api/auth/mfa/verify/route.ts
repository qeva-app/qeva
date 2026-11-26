import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  openMfaSecret,
  verifyTotp,
  looksLikeBackupCode,
  consumeBackupCode,
} from '@/lib/mfa';
import { setMfaCookie } from '@/lib/mfa-session';
import { checkRateLimit } from '@/lib/api';
import { logAudit, AuditActions } from '@/lib/audit';

/** Complete MFA for SSO (or any session still pending MFA). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(`mfa-verify:${session.user.id}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const { code } = await req.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
  }

  let ok = false;
  if (looksLikeBackupCode(code)) {
    const remaining = await consumeBackupCode(user.twoFactorBackupCodes, code);
    if (!remaining) {
      return NextResponse.json(
        { error: 'This backup code has already been used or is not valid. Each backup code works only once.' },
        { status: 400 }
      );
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorBackupCodes: JSON.stringify(remaining) },
    });
    ok = true;
  }
  if (!ok) {
    try {
      ok = verifyTotp(openMfaSecret(user.twoFactorSecret), code);
    } catch {
      ok = false;
    }
  }

  if (!ok) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  setMfaCookie(session.user.id);

  await logAudit({
    userId: session.user.id,
    action: AuditActions.MFA_VERIFIED,
    resource: 'auth',
    details: { via: 'session_stepup' },
    req,
  });

  return NextResponse.json({ message: 'MFA verified' });
}
