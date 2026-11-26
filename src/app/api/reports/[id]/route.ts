import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { getActorOrganizationId } from '@/lib/org-access';
import { withAuth } from '@/lib/auth-middleware';

async function getReport(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getActorOrganizationId(userId);
  const report = await prisma.report.findFirst({
    where: organizationId
      ? { id: params.id, user: { organizationId } }
      : { id: params.id, userId },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    ...report,
    size: report.size != null ? report.size.toString() : null,
  });
}

async function deleteReport(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getActorOrganizationId(userId);
  const existing = await prisma.report.findFirst({
    where: organizationId
      ? { id: params.id, user: { organizationId } }
      : { id: params.id, userId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.report.delete({ where: { id: params.id } });

  await logAudit({
    userId,
    action: AuditActions.REPORT_DELETED,
    resource: 'report',
    details: { reportId: params.id },
    req,
  });

  return NextResponse.json({ message: 'Report deleted' });
}

export const GET = withAuth(getReport, 'REPORT:VIEW');
export const DELETE = withAuth(deleteReport, 'REPORT:GENERATE');
