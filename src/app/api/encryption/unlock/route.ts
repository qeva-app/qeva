import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { checkRateLimit } from '@/lib/api';

/**
 * Client unlocks the DEK in-browser. This endpoint only records unlock time
 * after the client proves it by sending the matching dekHash (no master password).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = checkRateLimit(`unlock:${session.user.id}`, 20, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many unlock attempts. Try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const dekHash = typeof body.dekHash === 'string' ? body.dekHash : '';
    if (!dekHash) {
      return NextResponse.json(
        { error: 'Client-side unlock required (send dekHash proof)' },
        { status: 400 }
      );
    }

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
      data: { lastUnlockAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      action: AuditActions.ENCRYPTION_UNLOCKED,
      resource: 'encryption',
      details: { via: 'client' },
      req,
    });

    return NextResponse.json({ message: 'Vault unlocked', clientSide: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unlock failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
