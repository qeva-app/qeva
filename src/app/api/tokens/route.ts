import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateApiKey } from '@/lib/api';
import crypto from 'crypto';
import { logAudit, AuditActions } from '@/lib/audit';
import { normalizeClientKind } from '@/lib/token-validator';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tokens = await prisma.accessToken.findMany({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      name: true,
      scopes: true,
      clientKind: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(tokens);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const scopes =
    Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes.map(String)
      : null;
  if (!scopes) {
    return NextResponse.json({ error: 'Pick at least one permission' }, { status: 400 });
  }

  const clientKind = normalizeClientKind(body.clientKind);
  const plainToken = generateApiKey();
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

  const token = await prisma.accessToken.create({
    data: {
      name: body.name,
      token: tokenHash,
      userId: session.user.id,
      scopes: JSON.stringify(scopes),
      clientKind,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      ipWhitelist: body.ipWhitelist,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.TOKEN_CREATED,
    resource: 'access_token',
    details: { tokenId: token.id, tokenName: token.name, clientKind },
    req,
  });

  return NextResponse.json({ ...token, plainToken }, { status: 201 });
}
