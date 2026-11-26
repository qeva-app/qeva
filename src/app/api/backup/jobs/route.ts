import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

async function handler() {
  const jobs = await prisma.backupJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  return NextResponse.json(jobs);
}

export const GET = withAuth(handler, 'BACKUP:MANAGE');
