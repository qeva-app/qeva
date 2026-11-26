import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createBackup } from '@/lib/backup';
import { logAudit, AuditActions } from '@/lib/audit';

async function handler(req: NextRequest) {
  const { configId } = await req.json();
  if (!configId) return NextResponse.json({ error: 'configId required' }, { status: 400 });

  const jobId = await createBackup(configId);

  const session = await getServerSession(authOptions);
  await logAudit({
    userId: session!.user!.id,
    action: AuditActions.BACKUP_EXECUTED,
    resource: 'backup',
    details: { configId, jobId },
    req,
  });

  return NextResponse.json({ jobId, message: 'Backup started' });
}

export const POST = withAuth(handler, 'BACKUP:MANAGE');
