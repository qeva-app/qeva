import crypto from 'crypto';
import { hashOtp, verifyOtpHash } from '@/lib/otp';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createInviteToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashOtp(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
}

export function verifyInviteToken(
  storedHash: string | null | undefined,
  submitted: string,
  expiresAt: Date | null | undefined
): boolean {
  if (!storedHash || !expiresAt) return false;
  if (new Date() > expiresAt) return false;
  return verifyOtpHash(storedHash, submitted);
}

export function inviteActivationUrl(email: string, token: string): string {
  const base = (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  const q = new URLSearchParams({ email, token });
  return `${base}/auth/activate?${q.toString()}`;
}
