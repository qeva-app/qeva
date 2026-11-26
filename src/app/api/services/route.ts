import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { PROBE_TYPES } from '@/lib/validation';
import { userCanAccessServices } from '@/lib/services-access';

function probeFields(body: Record<string, unknown>) {
  const probeType =
    typeof body.probeType === 'string' && (PROBE_TYPES as readonly string[]).includes(body.probeType)
      ? body.probeType
      : body.probeType === null || body.probeType === ''
        ? null
        : undefined;
  const probeUrl =
    typeof body.probeUrl === 'string'
      ? body.probeUrl || null
      : body.probeUrl === null
        ? null
        : undefined;
  const probeAuth =
    typeof body.probeAuth === 'string'
      ? body.probeAuth || null
      : body.probeAuth === null
        ? null
        : undefined;
  return { probeType, probeUrl, probeAuth };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await userCanAccessServices(session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await userCanAccessServices(session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const probes = probeFields(body);
  const service = await prisma.service.create({
    data: {
      name: body.name,
      description: body.description,
      icon: body.icon,
      category: body.category,
      website: body.website,
      ...(probes.probeType !== undefined ? { probeType: probes.probeType } : {}),
      ...(probes.probeUrl !== undefined ? { probeUrl: probes.probeUrl } : {}),
      ...(probes.probeAuth !== undefined ? { probeAuth: probes.probeAuth } : {}),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SERVICE_CREATED,
    resource: 'service',
    details: { serviceId: service.id, serviceName: service.name },
    req,
  });

  return NextResponse.json(service, { status: 201 });
}
