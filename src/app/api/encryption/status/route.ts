import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { encryptionEnabled: true, encryptionSetupAt: true, lastUnlockAt: true },
  });

  return NextResponse.json({
    encryptionEnabled: user?.encryptionEnabled ?? false,
    // Unlock state is client-side only (DEK never held on server for USER_MASTER)
    isUnlocked: false,
    setupAt: user?.encryptionSetupAt,
    lastUnlockAt: user?.lastUnlockAt,
    clientSideUnlock: true,
  });
}
