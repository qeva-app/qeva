import crypto from 'crypto';
import argon2 from 'argon2';
import {
  VAULT_FORMAT_VERSION,
  AES_IV_BYTES,
  DEK_BYTES,
  SALT_BYTES,
  ARGON2ID,
} from './crypto-params';

const ALGORITHM = 'aes-256-gcm';

interface EncryptedData {
  version: string;
  kdf?: string;
  iv: string;
  authTag: string;
  encrypted: string;
}

function isWeakEncryptionKey(key: string): boolean {
  return (
    key.length < 32 ||
    /^(your-?|change-?me|placeholder|secret|encryption.?key)/i.test(key.trim())
  );
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (isWeakEncryptionKey(key)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY is too short (<32) or still a placeholder - set a strong random secret'
      );
    }
    console.warn('[crypto] ENCRYPTION_KEY looks weak/placeholder - OK in development only');
  }
  return crypto.createHash('sha256').update(key).digest();
}

/** Root vault key (PUBLIC_KEY / wrapping). Prefer org-scoped keys for shared entries. */
export function getRootEncryptionKey(): Buffer {
  return getEncryptionKey();
}

/** Encrypt optional notes the same way as the password; empty stays empty. */
export function encryptNotes(
  notes: string | null | undefined,
  keyOverride?: Buffer
): string | null {
  if (notes == null || notes === '') return notes ?? null;
  return encrypt(notes, keyOverride);
}

/**
 * Decrypt notes. Legacy plaintext notes (pre-encryption) are returned as-is.
 * shortcut: plaintext legacy notes stay readable until next edit; re-save encrypts them.
 */
export function decryptNotes(
  notes: string | null | undefined,
  keyOverride?: Buffer
): string | null {
  if (notes == null || notes === '') return notes ?? null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed?.version && parsed.iv && parsed.encrypted) {
      return decrypt(notes, keyOverride);
    }
  } catch {
    /* not JSON ciphertext - legacy plaintext */
  }
  return notes;
}

export function encrypt(plaintext: string, keyOverride?: Buffer): string {
  const key = keyOverride || getEncryptionKey();
  const iv = crypto.randomBytes(AES_IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const result: EncryptedData = {
    version: VAULT_FORMAT_VERSION,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted,
  };

  return JSON.stringify(result);
}

export function decrypt(encryptedStr: string, keyOverride?: Buffer): string {
  const data: EncryptedData = JSON.parse(encryptedStr);

  if (data.version !== VAULT_FORMAT_VERSION && data.version !== 'v2') {
    throw new Error(`Unsupported encryption format version: ${data.version}`);
  }

  const key = keyOverride || getEncryptionKey();
  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Derive a 32-byte KEK from a master password using Argon2id.
 * Replaces PBKDF2 - memory-hard against GPU/ASIC guessing.
 */
export async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  const raw = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: ARGON2ID.memoryCost,
    timeCost: ARGON2ID.timeCost,
    parallelism: ARGON2ID.parallelism,
    hashLength: ARGON2ID.hashLength,
    salt,
    raw: true,
  });
  return Buffer.from(raw);
}

/** @deprecated Use deriveKey (Argon2id). Kept only if something still imports the sync name. */
export function deriveKeyPbkdf2(
  password: string,
  salt: Buffer,
  iterations = 150000,
  hashAlgorithm = 'sha256'
): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, hashAlgorithm);
}

export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_BYTES);
}

export function hashSHA256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateDEK(): Buffer {
  return crypto.randomBytes(DEK_BYTES);
}

export function encryptWithKey(plaintext: string | Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(AES_IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const input = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  let encrypted = cipher.update(input);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  const result: EncryptedData = {
    version: VAULT_FORMAT_VERSION,
    kdf: ARGON2ID.type,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted.toString('hex'),
  };

  return JSON.stringify(result);
}

export function decryptWithKey(encryptedStr: string, key: Buffer): Buffer {
  const data: EncryptedData = JSON.parse(encryptedStr);

  if (data.version !== VAULT_FORMAT_VERSION && data.version !== 'v2') {
    throw new Error(`Unsupported encryption format version: ${data.version}`);
  }

  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(Buffer.from(data.encrypted, 'hex'));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted;
}
