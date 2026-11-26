import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

/**
 * Client builds salt/encryptedDEK/dekHash in the browser.
 * Master password never reaches this endpoint.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { salt, encryptedDEK, dekHash } = await req.json();
    if (!salt || !encryptedDEK || !dekHash) {
      return NextResponse.json(
        { error: 'Client setup material (salt, encryptedDEK, dekHash) is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { encryptionEnabled: true },
    });
    if (existing?.encryptionEnabled) {
      return NextResponse.json({ error: 'Encryption already enabled' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        encryptionEnabled: true,
        // Disable uses dekHash proof; no password hash needed for new setups
        masterPasswordHash: null,
        encryptedDEK,
        dekHash,
        salt,
        encryptionSetupAt: new Date(),
        lastUnlockAt: new Date(),
      },
    });

    await logAudit({
      userId: session.user.id,
      action: AuditActions.ENCRYPTION_SETUP,
      resource: 'encryption',
      details: { via: 'client' },
      req,
    });

    try {
      const { syncWorkflowsForUser } = await import('@/lib/workflows');
      await syncWorkflowsForUser(session.user.id);
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({
      message: 'Encryption setup complete',
      recoveryData: {
        userId: session.user.id,
        email: session.user.email,
        encryptedDEK,
        salt,
        dekHash,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Setup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
