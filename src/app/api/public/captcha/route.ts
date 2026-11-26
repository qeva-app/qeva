import { NextRequest, NextResponse } from 'next/server';
import { marketingCorsHeaders } from '@/lib/marketing-cors';
import { issueCaptcha } from '@/lib/public-captcha';
import { checkRateLimit } from '@/lib/api';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: marketingCorsHeaders(req.headers.get('origin')),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const headers = marketingCorsHeaders(origin);
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const limit = checkRateLimit(`captcha:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers });
  }

  return NextResponse.json(issueCaptcha(), { headers });
}
