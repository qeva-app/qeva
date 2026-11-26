// Client-side credential encryption using the Web Crypto API.
// A one-time AES-256-GCM key seals the credentials and RSA-OAEP wraps that key,
// so there is no length limit on what can be encrypted.

let cachedPublicKey: CryptoKey | null = null;

async function getPublicKey(): Promise<CryptoKey> {
  if (cachedPublicKey) return cachedPublicKey;

  const response = await fetch('/api/auth/public-key', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch public key');

  const { publicKey } = await response.json();

  // Convert PEM to ArrayBuffer
  const pemContents = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
  const binaryStr = atob(pemContents);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  cachedPublicKey = await window.crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  return cachedPublicKey;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Seals the credentials for `decryptCredentials` in server-crypto.ts. Returns
 * `base64(wrapped AES key).base64(IV).base64(ciphertext + tag)`.
 * Throws if Web Crypto is unavailable (insecure origin) or the key can't be fetched.
 */
export async function encryptCredentials(
  email: string,
  password: string,
  totp?: string
): Promise<string> {
  const publicKey = await getPublicKey();
  const { subtle } = window.crypto;

  const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const body: { email: string; password: string; totp?: string } = { email, password };
  if (totp) body.totp = totp;
  const plaintext = new TextEncoder().encode(JSON.stringify(body));

  const [sealed, rawKey] = await Promise.all([
    subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext),
    subtle.exportKey('raw', aesKey),
  ]);
  const wrappedKey = await subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey);

  return [new Uint8Array(wrappedKey), iv, new Uint8Array(sealed)].map(toBase64).join('.');
}

/** Drops the cached public key so the next call fetches the server's current one. */
export function resetPublicKey(): void {
  cachedPublicKey = null;
}

export async function preWarmPublicKey(): Promise<void> {
  try {
    await getPublicKey();
  } catch {
    // Silently fail - will retry on actual use
  }
}
