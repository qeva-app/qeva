import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { SAFE_USER_SELECT } from '@/lib/safe-user';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: SAFE_USER_SELECT,
  });

  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowedFields = [
    'firstName',
    'lastName',
    'name',
    'department',
    'position',
    'jobTitle',
    'phone',
    'location',
  ] as const;
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: SAFE_USER_SELECT,
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.PROFILE_UPDATED,
    resource: 'profile',
    details: { updatedFields: Object.keys(updateData) },
    req,
  });

  return NextResponse.json(user);
}
