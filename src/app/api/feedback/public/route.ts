import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`feedback:public:${ip}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json();
  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: {
      type: body.type || 'feature',
      page: typeof body.page === 'string' ? body.page : undefined,
      title: body.title.slice(0, 200),
      description:
        typeof body.description === 'string' ? body.description.slice(0, 5000) : undefined,
      priority: body.priority || 'medium',
      rating: typeof body.rating === 'number' ? body.rating : undefined,
    },
  });
  return NextResponse.json(feedback, { status: 201 });
}
