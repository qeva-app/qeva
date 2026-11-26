import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

type Ctx = { params: { id: string } };

/** Revoke (deactivate) a shared link you created. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const link = await prisma.sharedLink.findFirst({
    where: { id: params.id, createdBy: session.user.id },
  });
  if (!link) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.sharedLink.update({
    where: { id: link.id },
    data: { isActive: false },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SHARED_LINK_REVOKED,
    resource: 'shared_link',
    details: { linkId: link.id, passwordEntryId: link.passwordEntryId },
    req,
  });

  return NextResponse.json({ ok: true });
}
