import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

async function handler(req: NextRequest, { params }: { params: { id: string } }) {
  const roles = await prisma.userRoleAssignment.findMany({
    where: { userId: params.id, isActive: true },
    include: { role: true },
  });
  return NextResponse.json(roles);
}

export const GET = withAuth(handler, 'USER:UPDATE');
