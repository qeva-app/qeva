import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { disableUserEncryption } from '@/lib/user-encryption';
import { lockDEK } from '@/lib/encryption-session';
import { logAudit, AuditActions } from '@/lib/audit';
import prisma from '@/lib/db';

/**
 * Prefer dekHash proof (client unlocked). Legacy masterPassword still accepted
 * for accounts that still have an Argon2 hash from older setups.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { dekHash, masterPassword } = await req.json();

    if (dekHash) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { encryptionEnabled: true, dekHash: true },
      });
      if (!user?.encryptionEnabled || !user.dekHash) {
        return NextResponse.json({ error: 'Encryption not set up' }, { status: 400 });
      }
      if (dekHash !== user.dekHash) {
        return NextResponse.json({ error: 'Unlock proof failed' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          encryptionEnabled: false,
          masterPasswordHash: null,
          encryptedDEK: null,
          dekHash: null,
          salt: null,
          encryptionSetupAt: null,
          lastUnlockAt: null,
        },
      });
    } else if (masterPassword) {
      await disableUserEncryption(session.user.id, masterPassword);
    } else {
      return NextResponse.json(
        { error: 'Unlock vault and send dekHash, or provide masterPassword' },
        { status: 400 }
      );
    }

    lockDEK(session.user.id);

    await logAudit({
      userId: session.user.id,
      action: AuditActions.ENCRYPTION_DISABLED,
      resource: 'encryption',
      details: { via: dekHash ? 'dekHash' : 'masterPassword' },
      req,
    });

    return NextResponse.json({ message: 'Encryption disabled' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Disable failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
