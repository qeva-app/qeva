import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { startBackupScheduler, stopBackupScheduler } from '@/lib/backup-scheduler';

async function handler(req: NextRequest) {
  const { action } = await req.json();
  if (action === 'start') {
    await startBackupScheduler();
    return NextResponse.json({ message: 'Backup scheduler started' });
  } else if (action === 'stop') {
    stopBackupScheduler();
    return NextResponse.json({ message: 'Backup scheduler stopped' });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export const POST = withAuth(handler, 'BACKUP:MANAGE');
