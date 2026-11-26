/**
 * Assert AES-GCM v3 + Argon2id KEK round-trip.
 * Run: node scripts/selfcheck-crypto.js
 */
const crypto = require('crypto');
const argon2 = require('argon2');

process.env.ENCRYPTION_KEY = 'dev-selfcheck-key-at-least-32-chars!!';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const FORMAT = 'v3';
const ARGON2 = { memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 };

function getKey() {
  return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
}

function encrypt(plaintext, keyOverride) {
  const key = keyOverride || getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return JSON.stringify({
    version: FORMAT,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    encrypted,
  });
}

function decrypt(encryptedStr, keyOverride) {
  const data = JSON.parse(encryptedStr);
  const key = keyOverride || getKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(data.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
  let out = decipher.update(data.encrypted, 'hex', 'utf8');
  out += decipher.final('utf8');
  return out;
}

async function deriveKek(password, salt) {
  const raw = await argon2.hash(password, {
    type: argon2.argon2id,
    ...ARGON2,
    salt,
    raw: true,
  });
  return Buffer.from(raw);
}

async function main() {
  const sample = 's3cret-value!';
  if (decrypt(encrypt(sample)) !== sample) throw new Error('root round-trip failed');

  const salt = crypto.randomBytes(32);
  const kek = await deriveKek('master-pass-for-test', salt);
  if (kek.length !== 32) throw new Error('KEK length');
  const wrapped = encrypt(sample, kek);
  if (decrypt(wrapped, kek) !== sample) throw new Error('Argon2id KEK round-trip failed');

  const kek2 = await deriveKek('wrong-password!!!!!', salt);
  let failed = false;
  try {
    decrypt(wrapped, kek2);
  } catch {
    failed = true;
  }
  if (!failed) throw new Error('wrong KEK should not decrypt');

  const root = getKey();
  const orgA = Buffer.from(crypto.hkdfSync('sha256', root, 'org-a', 'qeva-org-dek-v1', 32));
  const orgB = Buffer.from(crypto.hkdfSync('sha256', root, 'org-b', 'qeva-org-dek-v1', 32));
  if (orgA.equals(orgB)) throw new Error('org HKDF keys must differ');

  console.log('selfcheck-crypto: ok (AES-256-GCM v3 + Argon2id)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
