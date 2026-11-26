// Request-scoped session caching using WeakMap
const sessionCache = new WeakMap<object, any>();

export function getCachedSession(req: object): any | null {
  return sessionCache.get(req) || null;
}

export function setCachedSession(req: object, session: any): void {
  sessionCache.set(req, session);
}
