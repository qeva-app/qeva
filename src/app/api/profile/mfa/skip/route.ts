import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

/** Dismiss the one-time MFA onboarding prompt (does not enable MFA). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaPromptPending: false,
      // Drop unused enrollment secret if they started QR then skipped
      ...(user?.twoFactorEnabled
        ? {}
        : { twoFactorSecret: null, twoFactorBackupCodes: null }),
    },
  });

  return NextResponse.json({ message: 'MFA setup skipped' });
}
