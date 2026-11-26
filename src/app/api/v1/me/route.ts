import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isV1Auth, requireV1Auth } from '@/lib/v1-auth';

/** Whoami for any client (human extension or agent) sharing the same token model. */
export async function GET(req: NextRequest) {
  const auth = await requireV1Auth(req);
  if (!isV1Auth(auth)) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      name: true,
      organizationId: true,
      userRoles: {
        where: { isActive: true },
        include: { role: true },
        orderBy: { isPrimary: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userRoles, ...rest } = user;
  return NextResponse.json({
    user: {
      ...rest,
      role: userRoles[0]?.role?.name ?? null,
    },
    token: {
      id: auth.tokenId,
      name: auth.tokenName,
      scopes: auth.scopes,
      clientKind: auth.clientKind,
    },
  });
}
