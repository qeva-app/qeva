import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RBACService } from '@/lib/permissions';
import prisma from '@/lib/db';

const ALLOWED = [
  'name',
  'type',
  'host',
  'port',
  'database',
  'username',
  'password',
  'ssl',
  'encrypt',
  'authSource',
  'status',
] as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission = await RBACService.hasPermissionDB(session.user.id, 'database:read');
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const connection = await prisma.databaseConnection.findUnique({ where: { id: params.id } });
  if (!connection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ...connection, password: undefined });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission = await RBACService.hasPermissionDB(session.user.id, 'database:write');
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const connection = await prisma.databaseConnection.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ ...connection, password: undefined });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission2 = await RBACService.hasPermissionDB(session.user.id, 'database:write');
  if (!hasPermission2) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.databaseConnection.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
