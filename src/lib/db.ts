import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL || '';
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: isLocalhost
      ? {
          db: {
            url: url.includes('trustServerCertificate')
              ? url
              : `${url};trustServerCertificate=true`,
          },
        }
      : undefined,
  });
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  // After `prisma generate`, Next may keep a stale singleton missing new delegates
  const hasDirectorySync =
    !!existing &&
    typeof (existing as { directorySyncConfig?: { findUnique?: unknown } })
      .directorySyncConfig?.findUnique === 'function';

  if (hasDirectorySync) return existing!;

  if (existing) {
    void existing.$disconnect().catch(() => {});
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrisma();

export default prisma;
