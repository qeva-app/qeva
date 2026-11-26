import { NextRequest, NextResponse } from 'next/server';
import { validateAccessToken } from '@/lib/token-validator';
import { getClientIp } from '@/lib/request-ip';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token } = body;

  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const ip = getClientIp(req);
  const result = await validateAccessToken(token, ip === 'unknown' ? undefined : ip);

  if (!result.valid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    userId: result.userId,
    tokenId: result.tokenId,
    scopes: result.scopes,
    clientKind: result.clientKind,
  });
}
