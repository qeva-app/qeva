import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const CODE_COUNT = 8;

/** Human-friendly one-time codes: `ABCD-EFGH` */
export function generateBackupCodes(count = CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  return Promise.all(codes.map((c) => bcrypt.hash(normalizeBackupCode(c), rounds)));
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export function looksLikeBackupCode(token: string): boolean {
  const n = normalizeBackupCode(token);
  return /^[A-F0-9]{8}$/i.test(n);
}

/**
 * Returns remaining hashes if a code matched (consumed), otherwise null.
 */
export async function consumeBackupCode(
  hashedCodesJson: string | null | undefined,
  token: string
): Promise<string[] | null> {
  if (!hashedCodesJson) return null;
  let hashes: string[];
  try {
    hashes = JSON.parse(hashedCodesJson);
  } catch {
    return null;
  }
  if (!Array.isArray(hashes) || hashes.length === 0) return null;

  const normalized = normalizeBackupCode(token);
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      return hashes.filter((_, idx) => idx !== i);
    }
  }
  return null;
}
