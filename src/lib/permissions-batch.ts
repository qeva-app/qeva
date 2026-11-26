import cache from './cache';
import { getUserPermissions } from './permissions';

const BATCH_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function loadAllPermissions(userId: string): Promise<string[]> {
  const cacheKey = `batch_perms:${userId}`;
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  const permissions = await getUserPermissions(userId);
  cache.set(cacheKey, permissions, BATCH_CACHE_TTL);
  return permissions;
}

export async function checkBatchPermissions(
  userId: string,
  requiredPermissions: string[]
): Promise<Record<string, boolean>> {
  const allPermissions = await loadAllPermissions(userId);
  const result: Record<string, boolean> = {};

  for (const perm of requiredPermissions) {
    result[perm] = allPermissions.includes(perm);
  }

  return result;
}
