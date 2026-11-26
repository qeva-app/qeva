import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  getPasswordAccessContext,
  canViewPassword,
} from '@/lib/password-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  const password = await prisma.passwordEntry.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { organizationId: true } },
      team: { select: { organizationId: true } },
    },
  });

  if (!password || !canViewPassword(password, ctx)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const history = await prisma.passwordHistory.findMany({
    where: { passwordEntryId: params.id },
    orderBy: { changedAt: 'desc' },
    select: {
      id: true,
      strength: true,
      encryptionType: true,
      changedAt: true,
      changedBy: true,
      changedByUser: { select: { name: true } },
    },
  });

  return NextResponse.json(
    history.map((h) => ({
      id: h.id,
      strength: h.strength,
      encryptionType: h.encryptionType,
      changedAt: h.changedAt,
      changedBy: h.changedByUser?.name || 'Unknown',
    }))
  );
}
