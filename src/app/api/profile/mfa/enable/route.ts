import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  openMfaSecret,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
} from '@/lib/mfa';
import { logAudit, AuditActions } from '@/lib/audit';
import { checkRateLimit } from '@/lib/api';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(`mfa-enable:${session.user.id}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const { code } = await req.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: 'Run MFA setup first' }, { status: 400 });
  }
  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 });
  }

  const secret = openMfaSecret(user.twoFactorSecret);
  if (!verifyTotp(secret, code)) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  const backupCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(backupCodes);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: JSON.stringify(hashed),
      mfaPromptPending: false,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.MFA_ENABLED,
    resource: 'mfa',
    details: {},
    req,
  });

  // Plaintext codes shown once — store them offline
  return NextResponse.json({ message: 'MFA enabled', backupCodes });
}
