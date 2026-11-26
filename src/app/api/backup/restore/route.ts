import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreBackup } from '@/lib/backup';
import { logAudit, AuditActions } from '@/lib/audit';

async function handler(req: NextRequest) {
  const { backupJobId } = await req.json();
  if (!backupJobId) return NextResponse.json({ error: 'backupJobId required' }, { status: 400 });

  const restoreId = await restoreBackup(backupJobId);

  const session = await getServerSession(authOptions);
  await logAudit({
    userId: session!.user!.id,
    action: AuditActions.BACKUP_RESTORED,
    resource: 'backup',
    details: { backupJobId, restoreId },
    req,
  });

  return NextResponse.json({ restoreId, message: 'Restore started' });
}

export const POST = withAuth(handler, 'BACKUP:MANAGE');
