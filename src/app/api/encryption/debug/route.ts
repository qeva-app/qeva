import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { isUnlocked } from '@/lib/encryption-session';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      encryptionEnabled: true,
      masterPasswordHash: true,
      encryptedDEK: true,
      dekHash: true,
      salt: true,
      encryptionSetupAt: true,
      lastUnlockAt: true,
    },
  });

  return NextResponse.json({
    encryptionEnabled: user?.encryptionEnabled,
    hasMasterPasswordHash: !!user?.masterPasswordHash,
    hasEncryptedDEK: !!user?.encryptedDEK,
    hasDekHash: !!user?.dekHash,
    hasSalt: !!user?.salt,
    setupAt: user?.encryptionSetupAt,
    lastUnlockAt: user?.lastUnlockAt,
    isUnlocked: isUnlocked(session.user.id),
  });
}
