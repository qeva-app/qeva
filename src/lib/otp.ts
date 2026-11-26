import crypto from 'crypto';
import { sendOTPEmail } from './smtp';
import { getDevOtp } from './dev-otp';
import logger from './logger';

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

export function verifyOtpHash(stored: string | null | undefined, submitted: string): boolean {
  if (!stored) return false;
  const submittedHash = hashOtp(submitted);
  // Constant-time compare
  try {
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(submittedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return stored === submitted; // legacy plaintext rows during transition
  }
}

export function otpExpiry(from = Date.now()): Date {
  return new Date(from + OTP_TTL_MS);
}

function smtpConfigured(): boolean {
  return !!process.env.EMAIL_SERVER_PASSWORD;
}

/**
 * Issue an OTP: email a random code when SMTP is configured.
 * Without SMTP, non-production falls back to the temporary DEV_OTP.
 * Stores only a hash — never log the plaintext code.
 */
export async function issueOtp(
  email: string,
  type: 'verification' | 'reset'
): Promise<{ otpHash: string; expiresAt: Date; emailSent: boolean; usedDevFallback: boolean }> {
  const expiresAt = otpExpiry();

  if (smtpConfigured()) {
    const otp = String(crypto.randomInt(100000, 1000000));
    await sendOTPEmail(email, otp, type);
    logger.info('OTP emailed', { email, type });
    return {
      otpHash: hashOtp(otp),
      expiresAt,
      emailSent: true,
      usedDevFallback: false,
    };
  }

  // Temporary local/dev path — production must configure SMTP (getDevOtp enforces that)
  const otp = getDevOtp();
  logger.warn('OTP email skipped — SMTP not configured; using temporary DEV_OTP', {
    email,
    type,
  });
  return {
    otpHash: hashOtp(otp),
    expiresAt,
    emailSent: false,
    usedDevFallback: true,
  };
}
