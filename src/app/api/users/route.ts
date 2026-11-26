import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const search = req.nextUrl.searchParams.get('search');
  const where: any = {};
  if (search) {
    where.OR = [{ name: { contains: search } }, { email: { contains: search } }];
  }

  // Scope to user's organization - only show users from the same org
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  if (currentUser?.organizationId) {
    where.organizationId = currentUser.organizationId;
  } else {
    // Individual users only see themselves
    where.id = session.user.id;
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, firstName: true, lastName: true, email: true, username: true, isActive: true, image: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'Use /api/auth/register' }, { status: 400 });
}
