import { encrypt, decrypt } from './encryption-unified';

interface DecryptTask {
  encrypted: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  key?: Buffer;
}

// Non-blocking batch decryption via setImmediate
export async function batchDecrypt(
  items: string[],
  key?: Buffer,
  batchSize = 10
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await new Promise<string[]>((resolve) => {
      setImmediate(() => {
        const decrypted = batch.map((item) => {
          try {
            return decrypt(item, key);
          } catch {
            return '[decryption failed]';
          }
        });
        resolve(decrypted);
      });
    });
    results.push(...batchResults);
  }

  return results;
}

export async function batchEncrypt(
  items: string[],
  key?: Buffer,
  batchSize = 10
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await new Promise<string[]>((resolve) => {
      setImmediate(() => {
        const encrypted = batch.map((item) => encrypt(item, key));
        resolve(encrypted);
      });
    });
    results.push(...batchResults);
  }

  return results;
}
