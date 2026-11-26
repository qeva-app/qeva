import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { withAuth } from '@/lib/auth-middleware';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { assertSameOrganization } from '@/lib/org-access';
import { requireSuperAdmin } from '@/lib/super-admin';

async function handler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, confirm } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  if (!requireSuperAdmin(session)) {
    const orgCheck = await assertSameOrganization(session.user.id, userId);
    if (!orgCheck.ok) {
      return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
    }
  }

  const masterCount = await prisma.passwordEntry.count({
    where: { userId, encryptionType: 'USER_MASTER' },
  });

  if (masterCount > 0 && confirm !== 'DESTROY_MASTER_KEY_ENTRIES') {
    return NextResponse.json(
      {
        error:
          'User has master-key encrypted passwords. Clearing encryption metadata will make them permanently unreadable.',
        masterKeyEntries: masterCount,
        hint: 'Re-send with confirm: "DESTROY_MASTER_KEY_ENTRIES" only after export/recovery.',
      },
      { status: 409 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptionEnabled: false,
      masterPasswordHash: null,
      encryptedDEK: null,
      dekHash: null,
      salt: null,
    },
  });

  return NextResponse.json({
    message: 'Encryption data cleared',
    masterKeyEntriesLeftOrphaned: masterCount,
  });
}

export const POST = withAuth(handler, 'SETTINGS:MANAGE');
