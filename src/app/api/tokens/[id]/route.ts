import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await prisma.accessToken.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(token);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const token = await prisma.accessToken.update({
    where: { id: params.id },
    data: { name: body.name, scopes: body.scopes ? JSON.stringify(body.scopes) : undefined, ipWhitelist: body.ipWhitelist },
  });
  return NextResponse.json(token);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.accessToken.update({ where: { id: params.id }, data: { isActive: false } });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.TOKEN_DELETED,
    resource: 'access_token',
    details: { tokenId: params.id },
    req,
  });

  return NextResponse.json({ message: 'Token revoked' });
}
