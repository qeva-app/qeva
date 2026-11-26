import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getServerSession } from 'next-auth';
import { authOptions, revokeUserSessions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { assertSameOrganization } from '@/lib/org-access';

async function handleGet(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgCheck = await assertSameOrganization(session.user.id, params.id);
  if (!orgCheck.ok) {
    return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      isActive: true,
      isVerified: true,
      department: true,
      position: true,
      jobTitle: true,
      phone: true,
      location: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      encryptionEnabled: true,
      twoFactorEnabled: true,
      emailNotifications: true,
      userRoles: { where: { isActive: true }, include: { role: true } },
    },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(user);
}

async function handlePut(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgCheck = await assertSameOrganization(session.user.id, params.id);
  if (!orgCheck.ok) {
    return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
  }

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  const allowedFields = [
    'firstName',
    'lastName',
    'name',
    'department',
    'position',
    'jobTitle',
    'phone',
    'location',
    'isActive',
    'isVerified',
  ] as const;
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      isActive: true,
      isVerified: true,
      department: true,
      position: true,
      jobTitle: true,
      phone: true,
      location: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      encryptionEnabled: true,
      twoFactorEnabled: true,
      emailNotifications: true,
    },
  });

  if (updateData.isActive === false) {
    revokeUserSessions(params.id);
    await prisma.userSession.updateMany({
      where: { userId: params.id, isActive: true },
      data: { isActive: false, logoutAt: new Date() },
    });
  }

  await logAudit({
    userId: session.user.id,
    action: AuditActions.USER_UPDATED,
    resource: 'user',
    details: { targetUserId: params.id, updatedFields: Object.keys(updateData) },
    req,
  });

  return NextResponse.json(user);
}

async function handleDelete(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgCheck = await assertSameOrganization(session.user.id, params.id);
  if (!orgCheck.ok) {
    return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
  }

  await prisma.user.update({ where: { id: params.id }, data: { isActive: false } });

  revokeUserSessions(params.id);
  await prisma.userSession.updateMany({
    where: { userId: params.id, isActive: true },
    data: { isActive: false, logoutAt: new Date() },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.USER_DELETED,
    resource: 'user',
    details: { targetUserId: params.id },
    req,
  });

  return NextResponse.json({ message: 'User deactivated' });
}

export const GET = withAuth(handleGet, 'USER:UPDATE');
export const PUT = withAuth(handlePut, 'USER:UPDATE');
export const DELETE = withAuth(handleDelete, 'USER:DEACTIVATE');
