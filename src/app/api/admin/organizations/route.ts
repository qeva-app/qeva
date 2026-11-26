import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { requireSuperAdmin } from '@/lib/super-admin';

// GET — list all organizations (with status filter)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');

  const where: any = {};
  if (status) where.status = status;

  const orgs = await prisma.organization.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, teams: true } },
    },
  });

  return NextResponse.json(orgs);
}

// POST — create organization manually (admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  const org = await prisma.organization.create({
    data: {
      name: body.name,
      domain: body.domain,
      description: body.description,
      contactEmail: body.contactEmail,
      status: body.status || 'PENDING',
      trialDays: body.trialDays || 14,
      logo: body.logo,
    },
  });

  const { ensureGeneralOnboarding } = await import('@/lib/workflows');
  await ensureGeneralOnboarding(org.id);

  await logAudit({
    userId: session.user.id,
    action: AuditActions.ORG_CREATED,
    resource: 'organization',
    details: { orgId: org.id, orgName: org.name },
    req,
  });

  return NextResponse.json(org, { status: 201 });
}
