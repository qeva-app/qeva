import { NextRequest, NextResponse } from 'next/server';
import { tokenHasScope, validateAccessToken, type ClientKind } from '@/lib/token-validator';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';

export type V1Auth = {
  userId: string;
  tokenId: string;
  tokenName: string;
  scopes: string[];
  clientKind: ClientKind;
};

export async function requireV1Auth(
  req: NextRequest,
  requiredScope?: string
): Promise<V1Auth | NextResponse> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(`v1:${ip}`, 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const result = await validateAccessToken(token, ip === 'unknown' ? undefined : ip);
  if (!result?.valid || !result.userId || !result.tokenId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (requiredScope && !tokenHasScope(result.scopes, requiredScope)) {
    return NextResponse.json({ error: `Missing scope: ${requiredScope}` }, { status: 403 });
  }

  return {
    userId: result.userId,
    tokenId: result.tokenId,
    tokenName: result.tokenName || '',
    scopes: result.scopes || [],
    clientKind: result.clientKind || 'HUMAN',
  };
}

export function isV1Auth(value: V1Auth | NextResponse): value is V1Auth {
  return !(value instanceof NextResponse);
}

export function auditClient(auth: V1Auth) {
  return {
    clientKind: auth.clientKind,
    tokenId: auth.tokenId,
    tokenName: auth.tokenName,
  };
}
