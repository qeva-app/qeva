// DEK session: HTTP-only cookie (multi-instance) + in-memory L1 cache (30-minute idle lock)

import {
  setDEKCookie,
  getDEKFromCookie,
  clearDEKCookie,
} from './encryption-session-cookie';

interface DEKSession {
  dek: Buffer;
  userId: string;
  unlockedAt: number;
  lastActivity: number;
}

const AUTO_LOCK_MS = 30 * 60 * 1000;
const sessions = new Map<string, DEKSession>();

export function storeDEK(userId: string, dek: Buffer): void {
  const now = Date.now();
  sessions.set(userId, {
    dek,
    userId,
    unlockedAt: now,
    lastActivity: now,
  });
  try {
    setDEKCookie(userId, dek.toString('hex'));
  } catch {
    // Route handlers without cookie store (rare) still keep memory session
  }
}

export function getDEK(userId: string): Buffer | null {
  const now = Date.now();
  const session = sessions.get(userId);
  if (session) {
    if (now - session.lastActivity > AUTO_LOCK_MS) {
      sessions.delete(userId);
    } else {
      session.lastActivity = now;
      try {
        setDEKCookie(userId, session.dek.toString('hex'));
      } catch {
        /* refresh best-effort */
      }
      return session.dek;
    }
  }

  try {
    const hex = getDEKFromCookie(userId);
    if (!hex) return null;
    const dek = Buffer.from(hex, 'hex');
    if (dek.length !== 32) return null;
    sessions.set(userId, {
      dek,
      userId,
      unlockedAt: now,
      lastActivity: now,
    });
    setDEKCookie(userId, hex);
    return dek;
  } catch {
    return null;
  }
}

export function lockDEK(userId: string): void {
  sessions.delete(userId);
  try {
    clearDEKCookie();
  } catch {
    /* ignore */
  }
}

export function isUnlocked(userId: string): boolean {
  return getDEK(userId) !== null;
}

export function getSessionInfo(userId: string): { unlockedAt: number; lastActivity: number } | null {
  if (!getDEK(userId)) return null;
  const session = sessions.get(userId);
  if (!session) return null;
  return {
    unlockedAt: session.unlockedAt,
    lastActivity: session.lastActivity,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions.entries()) {
    if (now - session.lastActivity > AUTO_LOCK_MS) {
      sessions.delete(userId);
    }
  }
}, 60 * 1000);
