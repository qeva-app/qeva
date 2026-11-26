import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateMfaSecret, sealMfaSecret, qrDataUrl } from '@/lib/mfa';
import { logAudit, AuditActions } from '@/lib/audit';

/** Start MFA enrollment: store sealed secret, return QR (not enabled until /enable). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });
  if (user?.twoFactorEnabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 });
  }

  const generated = generateMfaSecret(session.user.email);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorSecret: sealMfaSecret(generated.base32),
      twoFactorEnabled: false,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.MFA_SETUP,
    resource: 'mfa',
    details: {},
    req,
  });

  const qr = await qrDataUrl(generated.otpauthUrl);
  return NextResponse.json({
    otpauthUrl: generated.otpauthUrl,
    qr,
    // Show once so the user can enter manually if QR fails
    secret: generated.base32,
  });
}
