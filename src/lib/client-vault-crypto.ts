/**
 * Browser-side USER_MASTER crypto. Master password and DEK never leave this module
 * except as ciphertext sent to the API.
 * v3: AES-256-GCM + Argon2id KEK (via @noble/hashes).
 */

import { argon2id } from '@noble/hashes/argon2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  VAULT_FORMAT_VERSION,
  AES_IV_BYTES,
  AES_TAG_BYTES,
  DEK_BYTES,
  SALT_BYTES,
  ARGON2ID,
} from './crypto-params';

let sessionDek: Uint8Array | null = null;
let unlockedAt = 0;
const AUTO_LOCK_MS = 30 * 60 * 1000;

function assertCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is required (HTTPS or localhost)');
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function asBufferSource(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function sha256Hex(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}

/** Argon2id KEK - same params as server `deriveKey` in encryption-unified.ts */
async function deriveKekRaw(masterPassword: string, saltHex: string): Promise<Uint8Array> {
  const password = new TextEncoder().encode(masterPassword);
  const salt = hexToBytes(saltHex);
  // noble argon2 is sync/CPU-heavy; yield so the UI can paint
  await new Promise((r) => setTimeout(r, 0));
  return argon2id(password, salt, {
    t: ARGON2ID.timeCost,
    m: ARGON2ID.memoryCost,
    p: ARGON2ID.parallelism,
    dkLen: ARGON2ID.hashLength,
  });
}

async function deriveKek(masterPassword: string, saltHex: string): Promise<CryptoKey> {
  assertCrypto();
  const raw = await deriveKekRaw(masterPassword, saltHex);
  return crypto.subtle.importKey('raw', asBufferSource(raw), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBufferSource(raw), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

type CipherJson = {
  version: string;
  kdf?: string;
  iv: string;
  authTag: string;
  encrypted: string;
};

async function decryptBlob(blob: string, key: CryptoKey): Promise<Uint8Array> {
  const data = JSON.parse(blob) as CipherJson;
  if (data.version !== VAULT_FORMAT_VERSION && data.version !== 'v2') {
    throw new Error('Unsupported cipher version');
  }
  const iv = hexToBytes(data.iv);
  const authTag = hexToBytes(data.authTag);
  const encrypted = hexToBytes(data.encrypted);
  const sealed = new Uint8Array(encrypted.length + authTag.length);
  sealed.set(encrypted);
  sealed.set(authTag, encrypted.length);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(sealed)
  );
  return new Uint8Array(plain);
}

async function encryptBlob(plaintext: Uint8Array, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      key,
      asBufferSource(plaintext)
    )
  );
  const encrypted = sealed.slice(0, sealed.length - AES_TAG_BYTES);
  const authTag = sealed.slice(sealed.length - AES_TAG_BYTES);
  return JSON.stringify({
    version: VAULT_FORMAT_VERSION,
    kdf: ARGON2ID.type,
    iv: bytesToHex(iv),
    authTag: bytesToHex(authTag),
    encrypted: bytesToHex(encrypted),
  });
}

function touch() {
  unlockedAt = Date.now();
}

function ensureDek(): Uint8Array {
  if (!sessionDek) throw new Error('Vault is locked');
  if (Date.now() - unlockedAt > AUTO_LOCK_MS) {
    sessionDek = null;
    throw new Error('Vault locked due to inactivity');
  }
  touch();
  return sessionDek;
}

export function isClientVaultUnlocked(): boolean {
  if (!sessionDek) return false;
  if (Date.now() - unlockedAt > AUTO_LOCK_MS) {
    sessionDek = null;
    return false;
  }
  return true;
}

export function lockClientVault(): void {
  sessionDek = null;
  unlockedAt = 0;
}

/** Unlock from sealed material - master password stays in the browser. Returns dekHash. */
export async function unlockClientVault(opts: {
  masterPassword: string;
  salt: string;
  encryptedDEK: string;
  dekHash?: string;
}): Promise<string> {
  const kek = await deriveKek(opts.masterPassword, opts.salt);
  const dek = await decryptBlob(opts.encryptedDEK, kek);
  const hash = sha256Hex(dek);
  if (opts.dekHash && hash !== opts.dekHash) {
    throw new Error('DEK integrity check failed');
  }
  sessionDek = dek;
  touch();
  return hash;
}

export async function encryptWithClientDek(plaintext: string): Promise<string> {
  const dek = ensureDek();
  const key = await importAesKey(dek);
  return encryptBlob(new TextEncoder().encode(plaintext), key);
}

export async function decryptWithClientDek(blob: string): Promise<string> {
  const dek = ensureDek();
  const key = await importAesKey(dek);
  const plain = await decryptBlob(blob, key);
  return new TextDecoder().decode(plain);
}

/** Build setup payload entirely in the browser; server only stores sealed material. */
export async function buildClientSetupMaterial(masterPassword: string): Promise<{
  salt: string;
  encryptedDEK: string;
  dekHash: string;
  recovery: { encryptedDEK: string; salt: string; dekHash: string };
}> {
  assertCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const dek = crypto.getRandomValues(new Uint8Array(DEK_BYTES));
  const saltHex = bytesToHex(salt);
  const kek = await deriveKek(masterPassword, saltHex);
  const encryptedDEK = await encryptBlob(dek, kek);
  const dekHash = sha256Hex(dek);
  sessionDek = dek;
  touch();
  return {
    salt: saltHex,
    encryptedDEK,
    dekHash,
    recovery: { encryptedDEK, salt: saltHex, dekHash },
  };
}

export function getClientDekHashForProof(): Promise<string> {
  const dek = ensureDek();
  return Promise.resolve(sha256Hex(dek));
}
