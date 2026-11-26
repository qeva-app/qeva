import {
  decryptWithClientDek,
  isClientVaultUnlocked,
} from '@/lib/client-vault-crypto';

/** Client helper: reveal one vault secret on demand. */
export async function fetchPasswordSecret(id: string): Promise<{
  password: string;
  notes: string | null;
  locked: boolean;
}> {
  const res = await fetch(`/api/passwords/${id}/reveal`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reveal password');
  }

  if (data.encryptionType === 'USER_MASTER') {
    if (data.ciphertext) {
      if (!isClientVaultUnlocked()) {
        throw new Error('Vault is locked - unlock encryption first');
      }
      const password = await decryptWithClientDek(data.ciphertext);
      let notes: string | null = data.notes ?? null;
      if (data.notesCiphertext) {
        try {
          notes = await decryptWithClientDek(data.notesCiphertext);
        } catch {
          notes = null;
        }
      }
      return { password, notes, locked: false };
    }
    if (data.locked) {
      throw new Error('Vault is locked - unlock encryption first');
    }
  }

  if (data.locked) {
    throw new Error('Vault is locked - unlock encryption first');
  }

  return {
    password: data.decryptedPassword || '',
    notes: data.notes ?? null,
    locked: !!data.locked,
  };
}
