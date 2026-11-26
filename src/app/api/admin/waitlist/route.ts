import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/super-admin';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const entries = await prisma.managedWaitlistEntry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return NextResponse.json(entries);
}
