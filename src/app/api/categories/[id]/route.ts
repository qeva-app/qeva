import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const category = await prisma.category.findUnique({ where: { id: params.id } });
  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(category);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const category = await prisma.category.update({
    where: { id: params.id },
    data: { name: body.name, description: body.description, color: body.color, icon: body.icon },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.CATEGORY_UPDATED,
    resource: 'category',
    details: { categoryId: params.id, categoryName: category.name },
    req,
  });

  return NextResponse.json(category);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.category.update({ where: { id: params.id }, data: { isActive: false } });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.CATEGORY_DELETED,
    resource: 'category',
    details: { categoryId: params.id },
    req,
  });

  return NextResponse.json({ message: 'Category deleted' });
}
