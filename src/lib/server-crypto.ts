import crypto from 'crypto';

type RsaKeyPair = { publicKey: string; privateKey: string };

// Kept on globalThis so every route bundle shares one keypair and a hot reload in
// development doesn't replace it — a new key would orphan the one browsers have cached.
const globalForCrypto = globalThis as unknown as { __qevaRsaKeyPair?: RsaKeyPair };

function getKeyPair(): RsaKeyPair {
  if (globalForCrypto.__qevaRsaKeyPair) return globalForCrypto.__qevaRsaKeyPair;

  const privateKeyPem = process.env.RSA_PRIVATE_KEY;
  let keyPair: RsaKeyPair;

  if (privateKeyPem) {
    // Derive public key from private key
    const privateKey = crypto.createPrivateKey(privateKeyPem.replace(/\\n/g, '\n'));
    const publicKey = crypto.createPublicKey(privateKey);

    keyPair = {
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
      privateKey: privateKeyPem.replace(/\\n/g, '\n'),
    };
  } else if (process.env.NODE_ENV !== 'production') {
    // Dev mode: auto-generate keypair
    keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    console.log('[crypto] Auto-generated RSA-2048 keypair for development');
  } else {
    throw new Error('RSA_PRIVATE_KEY environment variable is required in production');
  }

  globalForCrypto.__qevaRsaKeyPair = keyPair;
  return keyPair;
}

export function getPublicKey(): string {
  return getKeyPair().publicKey;
}

const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

/**
 * Opens the envelope built by `encryptCredentials` in client-crypto.ts:
 * `base64(RSA-OAEP-wrapped AES key).base64(IV).base64(AES-256-GCM ciphertext + tag)`.
 * Throws if the envelope is malformed or was sealed for a different key.
 */
export function decryptCredentials(envelope: string): {
  email: string;
  password: string;
  totp?: string;
} {
  const parts = envelope.split('.');
  if (parts.length !== 3) throw new Error('Malformed credential envelope');
  const [wrappedKey, iv, sealed] = parts.map((part) => Buffer.from(part, 'base64'));

  const aesKey = crypto.privateDecrypt(
    {
      key: getKeyPair().privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    wrappedKey
  );

  if (aesKey.length !== AES_KEY_BYTES || iv.length !== GCM_IV_BYTES || sealed.length <= GCM_TAG_BYTES) {
    throw new Error('Malformed credential envelope');
  }

  const tagStart = sealed.length - GCM_TAG_BYTES;
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(sealed.subarray(tagStart));
  const plaintext = Buffer.concat([decipher.update(sealed.subarray(0, tagStart)), decipher.final()]);

  const parsed = JSON.parse(plaintext.toString('utf8'));
  if (typeof parsed?.email !== 'string' || typeof parsed?.password !== 'string') {
    throw new Error('Malformed credential envelope');
  }
  return {
    email: parsed.email,
    password: parsed.password,
    totp: typeof parsed.totp === 'string' ? parsed.totp : undefined,
  };
}
