import { NextRequest, NextResponse } from 'next/server';
import { validateAccessToken } from '@/lib/token-validator';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const result = await validateAccessToken(token, ip);
  return NextResponse.json(result);
}
