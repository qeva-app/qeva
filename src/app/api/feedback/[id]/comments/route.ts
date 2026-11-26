import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await prisma.feedbackComment.findMany({
    where: { feedbackId: params.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const comment = await prisma.feedbackComment.create({
    data: {
      feedbackId: params.id,
      content: body.content,
      authorId: session.user.id,
      authorName: session.user.name,
      isAdmin: session.user.role === 'ADMIN',
    },
  });
  return NextResponse.json(comment, { status: 201 });
}
