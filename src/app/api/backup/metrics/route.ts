import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

async function handler() {
  const [totalConfigs, totalJobs, completedJobs, failedJobs] = await Promise.all([
    prisma.backupConfig.count(),
    prisma.backupJob.count(),
    prisma.backupJob.count({ where: { status: 'completed' } }),
    prisma.backupJob.count({ where: { status: 'failed' } }),
  ]);

  const lastBackup = await prisma.backupJob.findFirst({
    where: { status: 'completed' },
    orderBy: { completedAt: 'desc' },
  });

  return NextResponse.json({
    totalConfigs, totalJobs, completedJobs, failedJobs,
    lastBackupAt: lastBackup?.completedAt,
    lastBackupSize: lastBackup?.size ? Number(lastBackup.size) : null,
  });
}

export const GET = withAuth(handler, 'BACKUP:MANAGE');
