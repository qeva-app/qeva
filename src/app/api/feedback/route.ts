import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const feedback = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json(feedback);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const feedback = await prisma.feedback.create({
    data: {
      type: body.type || 'feature',
      page: body.page,
      title: body.title,
      description: body.description,
      priority: body.priority || 'medium',
      rating: body.rating,
      userId: session.user.id,
    },
  });
  return NextResponse.json(feedback, { status: 201 });
}
