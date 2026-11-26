import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';
import { PERMISSION_GROUPS, ORG_ROLE_PERMISSIONS } from '@/lib/rbac-catalog';

async function handler() {
  const permissions = await prisma.permission.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({
    permissions,
    groups: PERMISSION_GROUPS,
    assignable: ORG_ROLE_PERMISSIONS,
  });
}

// ROLE:MANAGE is enough to list the catalog while editing roles
export const GET = withAuth(handler, 'ROLE:MANAGE');
