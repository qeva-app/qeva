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

/** Public managed-hosting interest capture (not a tenant provisioner). */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const headers = marketingCorsHeaders(origin);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const limit = checkRateLimit(`waitlist:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const company = typeof body.company === 'string' ? body.company.trim().slice(0, 200) : undefined;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : undefined;
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 80) : 'marketing';

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400, headers });
  }

  try {
    await prisma.managedWaitlistEntry.upsert({
      where: { email },
      create: { email, company, name, source },
      update: {
        ...(company ? { company } : {}),
        ...(name ? { name } : {}),
        source,
      },
    });
    return NextResponse.json(
      {
        ok: true,
        message: 'You are on the list. We will email you when managed hosting is ready.',
      },
      { headers }
    );
  } catch (error) {
    logger.error('Waitlist signup failed', { error });
    return NextResponse.json({ error: 'Could not save interest' }, { status: 500, headers });
  }
}
