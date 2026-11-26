import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const category = await prisma.category.create({
    data: { name: body.name, description: body.description, color: body.color, icon: body.icon },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.CATEGORY_CREATED,
    resource: 'category',
    details: { categoryId: category.id, categoryName: category.name },
    req,
  });

  return NextResponse.json(category, { status: 201 });
}
