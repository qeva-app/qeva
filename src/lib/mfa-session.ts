import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE = 'qeva_mfa';
const TTL_MS = 30 * 60 * 1000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET required for MFA session');
  return s;
}

export function createMfaCookieValue(userId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyMfaCookieValue(value: string, userId: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [uid, expStr, sig] = parts;
  if (uid !== userId) return false;
  if (Date.now() > Number(expStr)) return false;
  const payload = `${uid}.${expStr}`;
  const expected = createHmac('sha256', secret()).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function setMfaCookie(userId: string): void {
  cookies().set(COOKIE, createMfaCookieValue(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  });
}

export function clearMfaCookie(): void {
  cookies().delete(COOKIE);
}

export function hasValidMfaCookie(userId: string): boolean {
  try {
    const value = cookies().get(COOKIE)?.value;
    if (!value) return false;
    return verifyMfaCookieValue(value, userId);
  } catch {
    return false;
  }
}
