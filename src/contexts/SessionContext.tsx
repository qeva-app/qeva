'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

interface SessionContextType {
  isActive: boolean;
  timeLeft: number | null;
  showWarning: boolean;
  dismissWarning: () => void;
  extendSession: () => void;
}

const SessionContext = createContext<SessionContextType>({
  isActive: true,
  timeLeft: null,
  showWarning: false,
  dismissWarning: () => {},
  extendSession: () => {},
});

export function useSessionContext() {
  return useContext(SessionContext);
}

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 5 * 60 * 1000; // Warning at 5 minutes left

export function SessionContextProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setShowWarning(false);
  }, []);

  const extendSession = useCallback(() => {
    resetActivity();
    fetch('/api/auth/session').catch(() => {});
  }, [resetActivity]);

  useEffect(() => {
    if (!session?.user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => document.addEventListener(e, resetActivity, { passive: true }));

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;
      const remaining = TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        signOut({ callbackUrl: '/auth/signin' });
      } else if (remaining <= WARNING_MS) {
        setShowWarning(true);
        setTimeLeft(Math.ceil(remaining / 1000));
      } else {
        setTimeLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, resetActivity));
      clearInterval(timerRef.current);
    };
  }, [session?.user, resetActivity]);

  return (
    <SessionContext.Provider
      value={{
        isActive: !!session?.user,
        timeLeft,
        showWarning,
        dismissWarning: () => setShowWarning(false),
        extendSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
