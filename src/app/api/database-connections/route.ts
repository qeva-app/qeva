import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RBACService } from '@/lib/permissions';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission = await RBACService.hasPermissionDB(session.user.id, 'database:read');
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const connections = await prisma.databaseConnection.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const safe = connections.map((c) => ({
    ...c,
    connectionString: undefined,
    password: undefined,
  }));

  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission = await RBACService.hasPermissionDB(session.user.id, 'database:write');
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, type, host, port, database, username, password, ssl, encrypt, authSource } = body;

  if (!name || !type) {
    return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
  }

  const connection = await prisma.databaseConnection.create({
    data: {
      name,
      type,
      host: host || '',
      port: port || 0,
      database: database || '',
      username: username || '',
      password: password || '',
      ssl: ssl || false,
      encrypt: encrypt || false,
      authSource: authSource || null,
      status: 'INACTIVE',
      userId: session.user.id,
    },
  });

  return NextResponse.json({ ...connection, password: undefined }, { status: 201 });
}
