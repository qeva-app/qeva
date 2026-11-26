import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getActorOrganizationId } from '@/lib/org-access';
import { withAuth } from '@/lib/auth-middleware';
import { buildDownloadPayload } from '@/lib/reports';

async function downloadReport(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getActorOrganizationId(userId);
  const report = await prisma.report.findFirst({
    where: organizationId
      ? { id: params.id, user: { organizationId } }
      : { id: params.id, userId },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const format = req.nextUrl.searchParams.get('format') || report.format || 'CSV';
  const { body, contentType, filename } = buildDownloadPayload(format, report.name, report.data);

  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withAuth(downloadReport, 'REPORT:EXPORT');
