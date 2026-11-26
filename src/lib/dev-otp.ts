/**
 * TEMPORARY development OTP until email delivery is wired.
 * Production refuses this stub unless ALLOW_DEV_OTP=true (emergency only).
 */
export function getDevOtp(): string {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_OTP !== 'true') {
    throw new Error(
      'Email OTP is not configured. Set up email delivery or ALLOW_DEV_OTP=true for emergency only.'
    );
  }
  return process.env.DEV_OTP || '123456';
}
