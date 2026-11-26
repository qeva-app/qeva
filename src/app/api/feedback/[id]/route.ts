import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const feedback = await prisma.feedback.findUnique({
    where: { id: params.id },
    include: { comments: true, user: { select: { name: true, email: true } } },
  });
  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(feedback);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const feedback = await prisma.feedback.update({
    where: { id: params.id },
    data: { status: body.status, priority: body.priority, adminNotes: body.adminNotes, resolvedBy: body.resolvedBy },
  });
  return NextResponse.json(feedback);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.feedback.delete({ where: { id: params.id } });
  return NextResponse.json({ message: 'Feedback deleted' });
}
