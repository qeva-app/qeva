import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { logAudit, AuditActions } from '@/lib/audit';
import { getActorOrganizationId } from '@/lib/org-access';
import { withAuth } from '@/lib/auth-middleware';
import { requireSuperAdmin } from '@/lib/super-admin';
import {
  REPORT_CATALOG,
  generateReportData,
  periodDays,
  resolveReportType,
  type ReportPeriod,
} from '@/lib/reports';

async function listReports(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getActorOrganizationId(userId);
  const reports = await prisma.report.findMany({
    where: organizationId ? { user: { organizationId } } : { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({
    catalog: REPORT_CATALOG,
    reports: reports.map((r) => ({
      ...r,
      size: r.size != null ? r.size.toString() : null,
    })),
  });
}

async function createReport(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const type = resolveReportType(body.type);
  if (!type) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  const period = (['7d', '30d', '90d', '1y'].includes(body.period) ? body.period : '30d') as ReportPeriod;
  const format = String(body.format || 'CSV').toUpperCase() === 'JSON' ? 'JSON' : 'CSV';
  const organizationId = await getActorOrganizationId(userId);
  const catalog = REPORT_CATALOG.find((c) => c.id === type)!;

  if (catalog.requiresOrg && !organizationId) {
    return NextResponse.json({ error: 'Organization required for this report' }, { status: 400 });
  }

  // Backup jobs are platform-wide (no org FK) - only super admin may export them
  if (type === 'backup') {
    const session = await getServerSession(authOptions);
    if (!requireSuperAdmin(session)) {
      return NextResponse.json(
        { error: 'Backup report requires platform super admin' },
        { status: 403 }
      );
    }
  }

  let generated;
  try {
    generated = await generateReportData({ type, period, organizationId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to generate report' }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      name: body.name || `${catalog.label} - ${new Date().toISOString().split('T')[0]}`,
      type,
      format,
      period,
      description: body.description || `${catalog.description} (last ${periodDays(period)} days)`,
      userId,
      status: 'COMPLETED',
      findings: generated.findings.length ? generated.findings.join('\n') : undefined,
      recommendations: generated.recommendations.length
        ? generated.recommendations.join('\n')
        : undefined,
      data: JSON.stringify({
        generatedAt: new Date().toISOString(),
        period,
        organizationId,
        type,
        summary: generated.summary,
        columns: generated.columns,
        rows: generated.rows,
        findings: generated.findings,
        recommendations: generated.recommendations,
      }),
      size: BigInt(
        Buffer.byteLength(
          JSON.stringify({ columns: generated.columns, rows: generated.rows }),
          'utf8'
        )
      ),
    },
  });

  await logAudit({
    userId,
    action: AuditActions.REPORT_GENERATED,
    resource: 'report',
    details: { reportId: report.id, reportName: report.name, type: report.type },
    req,
  });

  return NextResponse.json(
    { ...report, size: report.size != null ? report.size.toString() : null },
    { status: 201 }
  );
}

export const GET = withAuth(listReports, 'REPORT:VIEW');
export const POST = withAuth(createReport, 'REPORT:GENERATE');
