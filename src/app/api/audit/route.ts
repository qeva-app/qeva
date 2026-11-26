import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

/** Own audit trail - Community and Enterprise. Org-wide export stays on Reports (EE). */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const take = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const cursor = url.searchParams.get('cursor')?.trim() || undefined;
  const format = url.searchParams.get('format');

  // CSV of recent own events (cap 1000)
  if (format === 'csv') {
    const rows = await prisma.auditLog.findMany({
      where: { userId: session.user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1000,
      select: {
        createdAt: true,
        action: true,
        resource: true,
        ipAddress: true,
        details: true,
      },
    });
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      'createdAt,action,resource,ipAddress,details',
      ...rows.map((r) =>
        [
          r.createdAt.toISOString(),
          r.action,
          r.resource || '',
          r.ipAddress || '',
          r.details || '',
        ]
          .map((c) => escape(String(c)))
          .join(',')
      ),
    ];
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="qeva-audit.csv"',
      },
    });
  }

  const rows = await prisma.auditLog.findMany({
    where: { userId: session.user.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      resource: true,
      details: true,
      ipAddress: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({ items, nextCursor });
}

/** Delete all audit rows for the signed-in user, then record a single purge event. */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await prisma.auditLog.deleteMany({
    where: { userId: session.user.id },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.AUDIT_PURGED,
    resource: 'audit',
    details: { deletedCount: result.count },
    req,
  });

  return NextResponse.json({ deleted: result.count });
}
