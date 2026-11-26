import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

async function handler() {
  const [users, passwords, teams, roles] = await Promise.all([
    prisma.user.count(),
    prisma.passwordEntry.count(),
    prisma.team.count(),
    prisma.role.count(),
  ]);

  return NextResponse.json({
    tables: { users, passwords, teams, roles },
    provider: 'postgresql',
  });
}

export const GET = withAuth(handler, 'SETTINGS:MANAGE');
