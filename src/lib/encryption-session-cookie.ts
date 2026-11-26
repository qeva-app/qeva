import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'qeva_dek_session';
const ALGORITHM = 'aes-256-gcm';
const COOKIE_MAX_AGE = 30 * 60; // 30 minutes

function getCookieKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('No secret configured for cookie encryption');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptCookieValue(value: string): string {
  const key = getCookieKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptCookieValue(encrypted: string): string {
  const key = getCookieKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid cookie format');

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(parts[2], 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/** Payload: `${userId}.${dekHex}` so another account on the same browser cannot reuse the DEK. */
export function setDEKCookie(userId: string, dekHex: string): void {
  const encrypted = encryptCookieValue(`${userId}.${dekHex}`);
  cookies().set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function getDEKFromCookie(userId: string): string | null {
  try {
    const cookie = cookies().get(COOKIE_NAME);
    if (!cookie?.value) return null;
    const payload = decryptCookieValue(cookie.value);
    const dot = payload.indexOf('.');
    if (dot <= 0) return null;
    if (payload.slice(0, dot) !== userId) return null;
    return payload.slice(dot + 1);
  } catch {
    return null;
  }
}

export function clearDEKCookie(): void {
  cookies().delete(COOKIE_NAME);
}
