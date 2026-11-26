import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { assertSameOrganization, getActorOrganizationId } from '@/lib/org-access';

const PROFILE_SELECT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
  isActive: true,
  department: true,
  position: true,
  image: true,
  createdAt: true,
} as const;

const SELF_EDIT_FIELDS = [
  'firstName',
  'lastName',
  'name',
  'department',
  'position',
  'jobTitle',
  'phone',
  'location',
  'image',
] as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.id !== params.id) {
    const orgCheck = await assertSameOrganization(session.user.id, params.id);
    if (!orgCheck.ok) {
      return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: PROFILE_SELECT,
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isSelf = session.user.id === params.id;
  const isAdmin = session.user.role === 'ADMIN';

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isSelf) {
    const orgCheck = await assertSameOrganization(session.user.id, params.id);
    if (!orgCheck.ok) {
      return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
    }
  }

  const body = await req.json();
  const updateData: Record<string, unknown> = {};
  for (const field of SELF_EDIT_FIELDS) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  // Only admins may flip account flags, and only within their org
  if (isAdmin && !isSelf) {
    if (body.isActive !== undefined) updateData.isActive = !!body.isActive;
    if (body.isVerified !== undefined) updateData.isVerified = !!body.isVerified;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  if (updateData.firstName !== undefined || updateData.lastName !== undefined) {
    const current = await prisma.user.findUnique({
      where: { id: params.id },
      select: { firstName: true, lastName: true },
    });
    const firstName =
      (updateData.firstName as string | undefined) ?? current?.firstName ?? '';
    const lastName =
      (updateData.lastName as string | undefined) ?? current?.lastName ?? '';
    if (updateData.name === undefined) {
      updateData.name = `${firstName} ${lastName}`.trim();
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: PROFILE_SELECT,
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orgCheck = await assertSameOrganization(session.user.id, params.id);
  if (!orgCheck.ok) {
    return NextResponse.json({ error: orgCheck.error }, { status: orgCheck.status });
  }

  // Prevent wiping the last org membership accidentally via self-delete path
  const actorOrg = await getActorOrganizationId(session.user.id);
  if (!actorOrg) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 });
  }

  await prisma.user.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ message: 'User deactivated' });
}
