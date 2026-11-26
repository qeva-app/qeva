import crypto from 'crypto';
import { sendOTPEmail } from './smtp';
import logger from './logger';

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Prefix on stored hash: emailed OTP may set isVerified; console OTP only unlocks accountReady. */
const EMAIL_PREFIX = 'e:';
const CONSOLE_PREFIX = 'c:';

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

function stripChannelPrefix(stored: string): string {
  if (stored.startsWith(EMAIL_PREFIX) || stored.startsWith(CONSOLE_PREFIX)) {
    return stored.slice(2);
  }
  return stored;
}

/** Whether this stored OTP hash was issued via SMTP (email ownership proof). */
export function otpProvesEmail(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(EMAIL_PREFIX);
}

export function verifyOtpHash(stored: string | null | undefined, submitted: string): boolean {
  if (!stored) return false;
  const hash = stripChannelPrefix(stored);
  const submittedHash = hashOtp(submitted);
  try {
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(submittedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return hash === submitted; // legacy plaintext rows during transition
  }
}

export function otpExpiry(from = Date.now()): Date {
  return new Date(from + OTP_TTL_MS);
}

export function smtpConfigured(): boolean {
  return !!(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_PASSWORD);
}

/**
 * Issue a one-time code.
 * SMTP configured → email a random code (proves email → isVerified on success).
 * No SMTP → log QEVA_SETUP_OTP for the operator (unlocks accountReady only, never isVerified).
 */
export async function issueOtp(
  email: string,
  type: 'verification' | 'reset'
): Promise<{ otpHash: string; expiresAt: Date; emailSent: boolean; provesEmail: boolean }> {
  const expiresAt = otpExpiry();
  const otp = String(crypto.randomInt(100000, 1000000));
  const bareHash = hashOtp(otp);

  if (smtpConfigured()) {
    await sendOTPEmail(email, otp, type);
    logger.info('OTP emailed', { email, type });
    return {
      otpHash: `${EMAIL_PREFIX}${bareHash}`,
      expiresAt,
      emailSent: true,
      provesEmail: true,
    };
  }

  // Operator must read container/app logs - never treat this as email proof
  console.log(`QEVA_SETUP_OTP=${otp} email=${email} type=${type}`);
  logger.warn('OTP email skipped - SMTP not configured; use QEVA_SETUP_OTP from logs', {
    email,
    type,
  });
  return {
    otpHash: `${CONSOLE_PREFIX}${bareHash}`,
    expiresAt,
    emailSent: false,
    provesEmail: false,
  };
}
