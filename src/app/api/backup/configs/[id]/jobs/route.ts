import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

async function handler(req: NextRequest, { params }: { params: { id: string } }) {
  const jobs = await prisma.backupJob.findMany({
    where: { configId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(jobs);
}

export const GET = withAuth(handler, 'BACKUP:MANAGE');
