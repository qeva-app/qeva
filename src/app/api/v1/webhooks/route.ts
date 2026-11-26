import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RBACService } from '@/lib/permissions';
import prisma from '@/lib/db';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission =
    (await RBACService.hasPermissionDB(session.user.id, 'SETTINGS:MANAGE')) ||
    (await RBACService.hasPermissionDB(session.user.id, 'admin:settings'));
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.webhookSubscription.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        session.user.organizationId ? { organizationId: session.user.organizationId } : undefined,
      ].filter(Boolean) as any,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
      organizationId: true,
    },
  });

  return NextResponse.json(
    list.map((w) => ({
      ...w,
      events: safeJsonArray(w.events),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission =
    (await RBACService.hasPermissionDB(session.user.id, 'SETTINGS:MANAGE')) ||
    (await RBACService.hasPermissionDB(session.user.id, 'admin:settings'));
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { url, events } = body;
  const secret = body.secret || crypto.randomBytes(24).toString('hex');

  if (!url || !events?.length) {
    return NextResponse.json({ error: 'url and events array are required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const row = await prisma.webhookSubscription.create({
    data: {
      url,
      secret,
      events: JSON.stringify(events),
      active: true,
      userId: session.user.id,
      organizationId: session.user.organizationId || null,
    },
  });

  return NextResponse.json(
    {
      id: row.id,
      url: row.url,
      events,
      active: true,
      secret, // shown once
    },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const existing = await prisma.webhookSubscription.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        session.user.organizationId ? { organizationId: session.user.organizationId } : undefined,
      ].filter(Boolean) as any,
    },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.webhookSubscription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function safeJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
