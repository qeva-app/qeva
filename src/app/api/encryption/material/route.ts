import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

/** Auth-only vault material for client-side unlock - no master password involved. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      encryptionEnabled: true,
      encryptedDEK: true,
      salt: true,
      dekHash: true,
      email: true,
    },
  });

  if (!user?.encryptionEnabled || !user.encryptedDEK || !user.salt || !user.dekHash) {
    return NextResponse.json({ error: 'Encryption not set up' }, { status: 400 });
  }

  return NextResponse.json({
    encryptedDEK: user.encryptedDEK,
    salt: user.salt,
    dekHash: user.dekHash,
    email: user.email,
  });
}
