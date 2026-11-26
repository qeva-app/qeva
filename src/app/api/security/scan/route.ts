import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runSecurityScan } from '@/lib/security-scan';
import { logAudit, AuditActions } from '@/lib/audit';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({} as { checkBreaches?: boolean }));
  const scanResult = await runSecurityScan(session.user.id, {
    checkBreaches: body.checkBreaches !== false,
  });

  // Persist scan to history
  await prisma.securityScan.create({
    data: {
      userId: session.user.id,
      grade: scanResult.grade,
      riskScore: scanResult.riskScore,
      totalIssues: scanResult.results.reduce((a, r) => a + r.affectedCount, 0),
      results: JSON.stringify(scanResult.results),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SECURITY_SCAN_TRIGGERED,
    resource: 'security_scan',
    details: {},
    req,
  });

  return NextResponse.json(scanResult);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

  const scans = await prisma.securityScan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      grade: true,
      riskScore: true,
      totalIssues: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ scans });
}
