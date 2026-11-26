import prisma from './db';
import crypto from 'crypto';

export type ClientKind = 'HUMAN' | 'AGENT';

export function normalizeClientKind(value: unknown): ClientKind {
  return String(value || '').toUpperCase() === 'AGENT' ? 'AGENT' : 'HUMAN';
}

export async function validateAccessToken(
  token: string,
  ipAddress?: string
): Promise<{
  valid: boolean;
  userId?: string;
  tokenId?: string;
  tokenName?: string;
  scopes?: string[];
  clientKind?: ClientKind;
}> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Only accept hashed tokens - plaintext legacy rows are no longer valid
  const accessToken = await prisma.accessToken.findFirst({
    where: {
      token: tokenHash,
      isActive: true,
    },
  });

  if (!accessToken) {
    return { valid: false };
  }

  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    return { valid: false };
  }

  if (accessToken.ipWhitelist) {
    if (!ipAddress) {
      return { valid: false };
    }
    const allowedIPs = accessToken.ipWhitelist.split(',').map((ip) => ip.trim()).filter(Boolean);
    if (allowedIPs.length > 0 && !allowedIPs.includes(ipAddress)) {
      return { valid: false };
    }
  }

  await prisma.accessToken.update({
    where: { id: accessToken.id },
    data: { lastUsedAt: new Date() },
  });

  let scopes: string[] = [];
  if (accessToken.scopes) {
    try {
      const parsed = JSON.parse(accessToken.scopes);
      if (Array.isArray(parsed)) scopes = parsed.map(String);
    } catch {
      scopes = [];
    }
  }

  return {
    valid: true,
    userId: accessToken.userId,
    tokenId: accessToken.id,
    tokenName: accessToken.name,
    scopes,
    clientKind: normalizeClientKind(accessToken.clientKind),
  };
}

/** Empty/missing scopes grant nothing - recreate legacy tokens with explicit scopes. */
export function tokenHasScope(scopes: string[] | undefined, required: string): boolean {
  if (!scopes || scopes.length === 0) return false;
  if (scopes.includes('*') || scopes.includes('passwords:*')) return true;
  return scopes.includes(required);
}
