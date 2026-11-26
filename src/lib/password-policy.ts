export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  excludeAmbiguous: boolean;
  excludeSimilar: boolean;
  defaultMode: 'password' | 'passphrase' | 'pronounceable';
  rotationDays: number;
  expiryWarningDays: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSymbol: true,
  excludeAmbiguous: false,
  excludeSimilar: false,
  defaultMode: 'password',
  rotationDays: 90,
  expiryWarningDays: 14,
};

export function parsePasswordPolicy(raw: unknown): PasswordPolicy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PASSWORD_POLICY };
  const o = raw as Record<string, unknown>;
  return {
    minLength: clampInt(o.minLength, 4, 128, DEFAULT_PASSWORD_POLICY.minLength),
    maxLength: clampInt(o.maxLength, 8, 128, DEFAULT_PASSWORD_POLICY.maxLength),
    requireUpper: bool(o.requireUpper, DEFAULT_PASSWORD_POLICY.requireUpper),
    requireLower: bool(o.requireLower, DEFAULT_PASSWORD_POLICY.requireLower),
    requireNumber: bool(o.requireNumber, DEFAULT_PASSWORD_POLICY.requireNumber),
    requireSymbol: bool(o.requireSymbol, DEFAULT_PASSWORD_POLICY.requireSymbol),
    excludeAmbiguous: bool(o.excludeAmbiguous, DEFAULT_PASSWORD_POLICY.excludeAmbiguous),
    excludeSimilar: bool(o.excludeSimilar, DEFAULT_PASSWORD_POLICY.excludeSimilar),
    defaultMode:
      o.defaultMode === 'passphrase' || o.defaultMode === 'pronounceable'
        ? o.defaultMode
        : 'password',
    rotationDays: clampInt(o.rotationDays, 7, 365, DEFAULT_PASSWORD_POLICY.rotationDays),
    expiryWarningDays: clampInt(
      o.expiryWarningDays,
      1,
      90,
      DEFAULT_PASSWORD_POLICY.expiryWarningDays
    ),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!password || password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (password.length > policy.maxLength) {
    errors.push(`Password must be at most ${policy.maxLength} characters`);
  }
  if (policy.requireUpper && !/[A-Z]/.test(password)) errors.push('Add an uppercase letter');
  if (policy.requireLower && !/[a-z]/.test(password)) errors.push('Add a lowercase letter');
  if (policy.requireNumber && !/[0-9]/.test(password)) errors.push('Add a number');
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) errors.push('Add a symbol');
  return { ok: errors.length === 0, errors };
}

/** Generator option overrides derived from policy. */
export function policyToGeneratorDefaults(policy: PasswordPolicy) {
  return {
    length: Math.max(policy.minLength, 16),
    uppercase: policy.requireUpper,
    lowercase: policy.requireLower,
    numbers: policy.requireNumber,
    symbols: policy.requireSymbol,
    excludeAmbiguous: policy.excludeAmbiguous,
    excludeSimilar: policy.excludeSimilar,
  };
}

export function nextExpiryDate(policy: PasswordPolicy, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + policy.rotationDays);
  return d.toISOString().slice(0, 10);
}

export function isExpiringSoon(
  expiryDate: Date | string | null | undefined,
  warningDays: number,
  now = new Date()
): boolean {
  if (!expiryDate) return false;
  const exp = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  if (Number.isNaN(exp.getTime())) return false;
  const ms = exp.getTime() - now.getTime();
  return ms <= warningDays * 24 * 60 * 60 * 1000;
}

export function isExpired(
  expiryDate: Date | string | null | undefined,
  now = new Date()
): boolean {
  if (!expiryDate) return false;
  const exp = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() < now.getTime();
}
