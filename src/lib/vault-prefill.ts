export const VAULT_PREFILL_KEY = 'qeva:prefill-credential';

export interface VaultPrefill {
  password?: string;
  title?: string;
  username?: string;
  website?: string;
  passwords?: { password: string; title?: string }[];
}

export function setVaultPrefill(data: VaultPrefill): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(VAULT_PREFILL_KEY, JSON.stringify(data));
}

export function consumeVaultPrefill(): VaultPrefill | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(VAULT_PREFILL_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(VAULT_PREFILL_KEY);
  try {
    return JSON.parse(raw) as VaultPrefill;
  } catch {
    return null;
  }
}
