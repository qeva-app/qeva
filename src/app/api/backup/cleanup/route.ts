import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

async function handler() {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - 30);

  const { count } = await prisma.backupJob.deleteMany({
    where: { status: 'completed', createdAt: { lt: retentionDate } },
  });

  return NextResponse.json({ message: `Cleaned up ${count} old backups` });
}

export const POST = withAuth(handler, 'BACKUP:MANAGE');
