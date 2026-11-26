import crypto from 'crypto';

function captchaSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev-captcha-only';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', captchaSecret()).update(payload).digest('hex');
}

/** Short arithmetic challenge for public marketing forms (no third-party captcha). */
export function issueCaptcha(): { question: string; token: string } {
  const a = 2 + Math.floor(Math.random() * 10);
  const b = 1 + Math.floor(Math.random() * 9);
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${a}|${b}|${exp}`;
  const token = Buffer.from(`${payload}|${sign(payload)}`).toString('base64url');
  return { question: `What is ${a} + ${b}?`, token };
}

export function verifyCaptcha(token: unknown, answer: unknown): boolean {
  if (typeof token !== 'string' || typeof answer !== 'string') return false;
  const expected = Number.parseInt(answer.trim(), 10);
  if (!Number.isFinite(expected)) return false;

  let raw: string;
  try {
    raw = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const parts = raw.split('|');
  if (parts.length !== 4) return false;
  const [aStr, bStr, expStr, sig] = parts;
  const payload = `${aStr}|${bStr}|${expStr}`;
  if (sig !== sign(payload)) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const a = Number(aStr);
  const b = Number(bStr);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a + b === expected;
}
