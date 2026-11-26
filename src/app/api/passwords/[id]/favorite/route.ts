import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

/** Toggle favorite — only the entry owner (isFavorite is stored on the shared row). */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pw = await prisma.passwordEntry.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { isFavorite: true },
  });

  if (!pw) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.passwordEntry.update({
    where: { id: params.id },
    data: { isFavorite: !pw.isFavorite },
    select: { isFavorite: true },
  });

  return NextResponse.json({ isFavorite: updated.isFavorite });
}
