import crypto from 'crypto';
import { getRootEncryptionKey } from './encryption-unified';

/**
 * Per-org DEK derived from the root key + org id (HKDF).
 * DB dump alone is not enough; each org's ciphertext uses a different key.
 * Legacy PUBLIC_KEY rows stay on the root key.
 */
export function getOrgEncryptionKey(organizationId: string): Buffer {
  const root = getRootEncryptionKey();
  return Buffer.from(
    crypto.hkdfSync('sha256', root, organizationId, 'qeva-org-dek-v1', 32)
  );
}

export function resolveVaultKey(opts: {
  encryptionType?: string | null;
  organizationId?: string | null;
}): Buffer | undefined {
  if (opts.encryptionType === 'ORG_KEY' && opts.organizationId) {
    return getOrgEncryptionKey(opts.organizationId);
  }
  return undefined; // caller uses root default
}
