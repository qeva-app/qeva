/**
 * Shared vault crypto parameters (browser + server must stay in lockstep).
 * v3: AES-256-GCM + Argon2id KEK (replaces v2 PBKDF2).
 */
export const VAULT_FORMAT_VERSION = 'v3';
export const AES_ALGORITHM = 'AES-GCM';
export const AES_IV_BYTES = 12; // NIST-recommended GCM nonce size
export const AES_TAG_BYTES = 16;
export const DEK_BYTES = 32;
export const SALT_BYTES = 32;

/** Argon2id KEK derivation — memoryCost is KiB (65536 = 64 MiB). */
export const ARGON2ID = {
  type: 'argon2id' as const,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
};
