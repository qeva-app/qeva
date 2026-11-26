import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { encrypt, decrypt } from './encryption-unified';
export {
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
  looksLikeBackupCode,
  normalizeBackupCode,
} from './mfa-backup';

const ISSUER = 'Qeva';

export function generateMfaSecret(email: string) {
  const secret = speakeasy.generateSecret({
    name: `${ISSUER} (${email})`,
    issuer: ISSUER,
    length: 20,
  });
  return {
    ascii: secret.ascii as string,
    base32: secret.base32 as string,
    otpauthUrl: secret.otpauth_url as string,
  };
}

export function sealMfaSecret(base32: string): string {
  return encrypt(base32);
}

export function openMfaSecret(sealed: string): string {
  return decrypt(sealed);
}

export function verifyTotp(base32: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: base32,
    encoding: 'base32',
    token: token.replace(/\s/g, ''),
    window: 1,
  });
}

export async function qrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 });
}
