import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

async function handler() {
  const restores = await prisma.backupRestore.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  return NextResponse.json(restores);
}

export const GET = withAuth(handler, 'BACKUP:MANAGE');
