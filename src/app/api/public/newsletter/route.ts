import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/api';
import logger from '@/lib/logger';
import { marketingCorsHeaders } from '@/lib/marketing-cors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: marketingCorsHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const headers = marketingCorsHeaders(origin);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const limit = checkRateLimit(`newsletter:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json(
      { ok: true, message: 'You are subscribed.' },
      { headers }
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 80) : 'marketing';

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400, headers });
  }

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source },
      update: { source },
    });
    return NextResponse.json(
      { ok: true, message: 'You are subscribed. Thanks for following along.' },
      { headers }
    );
  } catch (error) {
    logger.error('Newsletter signup failed', { error });
    return NextResponse.json({ error: 'Could not subscribe' }, { status: 500, headers });
  }
}
