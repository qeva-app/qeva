import argon2 from 'argon2';
import {
  deriveKey,
  generateSalt,
  generateDEK,
  encryptWithKey,
  decryptWithKey,
  hashSHA256,
} from './encryption-unified';
import prisma from './db';

export interface EncryptionSetupResult {
  encryptedDEK: string;
  masterPasswordHash: string;
  dekHash: string;
  salt: string;
  /** In-process only - never send to the client */
  dek: Buffer;
  recoveryData: {
    userId: string;
    email: string;
    encryptedDEK: string;
    salt: string;
    dekHash: string;
  };
}

/** Legacy server-side setup (prefer client buildClientSetupMaterial). */
export async function setupUserEncryption(
  userId: string,
  email: string,
  masterPassword: string
): Promise<EncryptionSetupResult> {
  const salt = generateSalt();
  const dek = generateDEK();
  const kek = await deriveKey(masterPassword, salt);
  const encryptedDEK = encryptWithKey(dek, kek);
  const masterPasswordHash = await argon2.hash(masterPassword, { type: argon2.argon2id });
  const dekHash = hashSHA256(dek);
  const saltHex = salt.toString('hex');

  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptionEnabled: true,
      masterPasswordHash,
      encryptedDEK,
      dekHash,
      salt: saltHex,
      encryptionSetupAt: new Date(),
      lastUnlockAt: new Date(),
    },
  });

  return {
    encryptedDEK,
    masterPasswordHash,
    dekHash,
    salt: saltHex,
    dek,
    recoveryData: { userId, email, encryptedDEK, salt: saltHex, dekHash },
  };
}

/** Legacy server unlock - prefer client unlockClientVault. */
export async function unlockUserVault(
  userId: string,
  masterPassword: string
): Promise<Buffer> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      masterPasswordHash: true,
      encryptedDEK: true,
      salt: true,
      dekHash: true,
      encryptionEnabled: true,
    },
  });

  if (!user || !user.encryptionEnabled) {
    throw new Error('Encryption not set up for this user');
  }
  if (!user.encryptedDEK || !user.salt) {
    throw new Error('Encryption data is incomplete');
  }

  if (user.masterPasswordHash) {
    const isValid = await argon2.verify(user.masterPasswordHash, masterPassword);
    if (!isValid) throw new Error('Invalid master password');
  }

  const salt = Buffer.from(user.salt, 'hex');
  const kek = await deriveKey(masterPassword, salt);
  const dek = decryptWithKey(user.encryptedDEK, kek);

  if (user.dekHash) {
    const dekHash = hashSHA256(dek);
    if (dekHash !== user.dekHash) throw new Error('DEK integrity check failed');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastUnlockAt: new Date() },
  });

  return dek;
}

export async function disableUserEncryption(
  userId: string,
  masterPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { masterPasswordHash: true },
  });

  if (!user?.masterPasswordHash) {
    throw new Error('Encryption not set up or requires dekHash proof instead');
  }

  const isValid = await argon2.verify(user.masterPasswordHash, masterPassword);
  if (!isValid) throw new Error('Invalid master password');

  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptionEnabled: false,
      masterPasswordHash: null,
      encryptedDEK: null,
      dekHash: null,
      salt: null,
      encryptionSetupAt: null,
      lastUnlockAt: null,
    },
  });
}

export async function recoverEncryption(
  userId: string,
  masterPassword: string,
  recoveryData: { encryptedDEK: string; salt: string }
): Promise<Buffer> {
  const salt = Buffer.from(recoveryData.salt, 'hex');
  const kek = await deriveKey(masterPassword, salt);
  const dek = decryptWithKey(recoveryData.encryptedDEK, kek);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dekHash: true },
  });

  if (user?.dekHash) {
    const dekHash = hashSHA256(dek);
    if (dekHash !== user.dekHash) {
      throw new Error('Recovery file does not match - DEK integrity check failed');
    }
  }

  return dek;
}
