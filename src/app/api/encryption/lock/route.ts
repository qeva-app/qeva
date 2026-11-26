import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { lockDEK } from '@/lib/encryption-session';
import { logAudit, AuditActions } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  lockDEK(session.user.id);

  await logAudit({
    userId: session.user.id,
    action: AuditActions.ENCRYPTION_LOCKED,
    resource: 'encryption',
    details: {},
    req,
  });

  return NextResponse.json({ message: 'Vault locked' });
}
