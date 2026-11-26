import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [totalUsers, totalTeams, totalPasswords] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.team.count({ where: { isActive: true } }),
    prisma.passwordEntry.count(),
  ]);

  return NextResponse.json({ totalUsers, totalTeams, totalPasswords });
}
