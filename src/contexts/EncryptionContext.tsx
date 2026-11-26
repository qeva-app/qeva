'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  unlockClientVault,
  lockClientVault,
  isClientVaultUnlocked,
  buildClientSetupMaterial,
  getClientDekHashForProof,
} from '@/lib/client-vault-crypto';

interface EncryptionState {
  isEnabled: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  lastUnlock: string | null;
}

interface EncryptionContextType {
  state: EncryptionState;
  unlock: (masterPassword: string) => Promise<boolean>;
  lock: () => Promise<void>;
  setup: (masterPassword: string) => Promise<{ recoveryData: unknown } | null>;
  disable: (masterPassword?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const EncryptionContext = createContext<EncryptionContextType | null>(null);

export function useEncryption() {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error('useEncryption must be used inside EncryptionProvider');
  return ctx;
}

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [state, setState] = useState<EncryptionState>({
    isEnabled: false,
    isUnlocked: false,
    isLoading: true,
    lastUnlock: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    if (!session?.user) {
      lockClientVault();
      setState({ isEnabled: false, isUnlocked: false, isLoading: false, lastUnlock: null });
      return;
    }
    try {
      const res = await fetch('/api/encryption/status');
      if (res.ok) {
        const data = await res.json();
        setState({
          isEnabled: !!(data.encryptionEnabled ?? data.enabled),
          isUnlocked: isClientVaultUnlocked(),
          isLoading: false,
          lastUnlock: data.lastUnlockAt || data.lastUnlock || null,
        });
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false, isUnlocked: isClientVaultUnlocked() }));
    }
  }, [session?.user]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 60_000);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  const unlock = useCallback(
    async (masterPassword: string) => {
      const mat = await fetch('/api/encryption/material');
      if (!mat.ok) return false;
      const material = await mat.json();
      try {
        const dekHash = await unlockClientVault({
          masterPassword,
          salt: material.salt,
          encryptedDEK: material.encryptedDEK,
          dekHash: material.dekHash,
        });
        await fetch('/api/encryption/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dekHash }),
        });
        await refresh();
        return true;
      } catch {
        lockClientVault();
        return false;
      }
    },
    [refresh]
  );

  const lock = useCallback(async () => {
    lockClientVault();
    await fetch('/api/encryption/lock', { method: 'POST' });
    await refresh();
  }, [refresh]);

  const setup = useCallback(
    async (masterPassword: string) => {
      try {
        const built = await buildClientSetupMaterial(masterPassword);
        // Master password stays in the browser — only sealed material is posted
        const res = await fetch('/api/encryption/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salt: built.salt,
            encryptedDEK: built.encryptedDEK,
            dekHash: built.dekHash,
          }),
        });
        if (!res.ok) {
          lockClientVault();
          return null;
        }
        const data = await res.json();
        await refresh();
        return {
          recoveryData: data.recoveryData || {
            userId: session?.user?.id,
            email: session?.user?.email,
            encryptedDEK: built.encryptedDEK,
            salt: built.salt,
            dekHash: built.dekHash,
          },
        };
      } catch {
        lockClientVault();
        return null;
      }
    },
    [refresh, session?.user?.id, session?.user?.email]
  );

  const disable = useCallback(
    async (masterPassword?: string) => {
      const body: Record<string, string> = {};
      if (isClientVaultUnlocked()) {
        body.dekHash = await getClientDekHashForProof();
      } else if (masterPassword) {
        body.masterPassword = masterPassword;
      } else {
        return false;
      }

      const res = await fetch('/api/encryption/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        lockClientVault();
        await refresh();
        return true;
      }
      return false;
    },
    [refresh]
  );

  return (
    <EncryptionContext.Provider value={{ state, unlock, lock, setup, disable, refresh }}>
      {children}
    </EncryptionContext.Provider>
  );
}
