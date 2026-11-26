'use client';

import { useSessionContext } from '@/contexts/SessionContext';
import { Clock, X } from 'lucide-react';

export default function SessionTimeoutWarning() {
  const { showWarning, timeLeft, dismissWarning, extendSession } = useSessionContext();

  if (!showWarning) return null;

  return (
    <div className="motion-panel-in fixed top-4 left-1/2 z-[100] flex max-w-md -translate-x-1/2 items-center gap-4 rounded-lg border border-border bg-card px-5 py-3 shadow-md">
      <Clock size={18} className="shrink-0 text-warning" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Session expiring soon</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {timeLeft !== null
            ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')} remaining`
            : 'Your session will expire due to inactivity'}
        </p>
      </div>
      <button onClick={extendSession} className="btn-sm btn-primary whitespace-nowrap">
        Stay Signed In
      </button>
      <button onClick={dismissWarning} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
