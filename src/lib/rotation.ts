import { isExpired, isExpiringSoon, type PasswordPolicy } from '@/lib/password-policy';

export function classifyExpiry(
  expiryDate: Date | string | null | undefined,
  policy: Pick<PasswordPolicy, 'expiryWarningDays'>
): 'ok' | 'expiring' | 'expired' | 'none' {
  if (!expiryDate) return 'none';
  if (isExpired(expiryDate)) return 'expired';
  if (isExpiringSoon(expiryDate, policy.expiryWarningDays)) return 'expiring';
  return 'ok';
}

export function needsRotation(
  expiryDate: Date | string | null | undefined,
  policy: Pick<PasswordPolicy, 'expiryWarningDays'>
): boolean {
  const status = classifyExpiry(expiryDate, policy);
  return status === 'expiring' || status === 'expired';
}
