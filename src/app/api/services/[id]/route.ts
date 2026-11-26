import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { PROBE_TYPES } from '@/lib/validation';
import { userCanAccessServices } from '@/lib/services-access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await userCanAccessServices(session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(service);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await userCanAccessServices(session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {
    name: body.name,
    description: body.description,
    icon: body.icon,
    category: body.category,
    website: body.website,
  };
  if (body.probeType !== undefined) {
    data.probeType =
      body.probeType && (PROBE_TYPES as readonly string[]).includes(body.probeType)
        ? body.probeType
        : null;
  }
  if (body.probeUrl !== undefined) data.probeUrl = body.probeUrl || null;
  if (body.probeAuth !== undefined) data.probeAuth = body.probeAuth || null;

  const service = await prisma.service.update({
    where: { id: params.id },
    data,
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SERVICE_UPDATED,
    resource: 'service',
    details: { serviceId: params.id, serviceName: service.name },
    req,
  });

  return NextResponse.json(service);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await userCanAccessServices(session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.service.update({ where: { id: params.id }, data: { isActive: false } });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SERVICE_DELETED,
    resource: 'service',
    details: { serviceId: params.id },
    req,
  });

  return NextResponse.json({ message: 'Service deleted' });
}
