import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { isAvatarPreset } from '@/lib/avatars';
import { SAFE_USER_SELECT } from '@/lib/safe-user';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const image = body?.image;

  if (image !== null && (typeof image !== 'string' || !isAvatarPreset(image))) {
    return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { image },
    select: SAFE_USER_SELECT,
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.PROFILE_UPDATED,
    resource: 'profile',
    details: { updatedFields: ['image'] },
    req,
  });

  return NextResponse.json(user);
}
