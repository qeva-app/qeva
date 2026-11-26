import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { checkRateLimit } from '@/lib/api';

/**
 * Client unlocks the recovery file in-browser, then posts sealed material + dekHash
 * proof. Master password never reaches the server.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(`recover:${session.user.id}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  try {
    const { encryptedDEK, salt, dekHash } = await req.json();
    if (!encryptedDEK || !salt || !dekHash) {
      return NextResponse.json(
        { error: 'Recovery material (encryptedDEK, salt, dekHash) required' },
        { status: 400 }
      );
    }

    // If vault still has a dekHash, recovery file must match it
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dekHash: true, email: true },
    });
    if (user?.dekHash && user.dekHash !== dekHash) {
      return NextResponse.json(
        { error: 'Recovery file does not match this account' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        encryptionEnabled: true,
        encryptedDEK,
        salt,
        dekHash,
        encryptionSetupAt: new Date(),
        lastUnlockAt: new Date(),
      },
    });

    await logAudit({
      userId: session.user.id,
      action: AuditActions.ENCRYPTION_RECOVERED,
      resource: 'encryption',
      details: { via: 'client' },
      req,
    });

    return NextResponse.json({ message: 'Encryption recovered successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Recovery failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
