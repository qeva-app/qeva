'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Clock, Lock, ShieldAlert, X } from 'lucide-react';
import type { FeatureAccess } from '@/lib/feature-access';

const DISMISS_KEY = 'qeva:org-banner-dismissed';

export default function OrgLifecycleBanner() {
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      if (raw) setDismissed(true);
    } catch {
      /* ignore */
    }
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.access) setAccess(data.access);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!access?.isOrgUser) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, access.orgStatus || '1');
    } catch {
      /* ignore */
    }
  };

  // Locked-out stays visible — blocking state, not dismissible noise
  if (access.isLockedOut) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-6 py-2">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2.5 text-sm">
          <Lock size={15} className="shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-foreground">
            <span className="font-semibold">{access.orgName}</span> is locked
            {access.orgStatus === 'EXPIRED' ? ' (subscription expired)' : ''}. Contact an admin to restore access.
          </p>
        </div>
      </div>
    );
  }

  if (dismissed) return null;

  let message: ReactNode = null;
  let Icon = ShieldAlert;
  let tone = 'border-warning/30 bg-warning/10 text-warning';

  if (access.isPendingApproval) {
    Icon = ShieldAlert;
    message = (
      <>
        <span className="font-semibold">{access.orgName}</span> awaits approval — personal vault works; teams, global vault, and admin tools unlock after activation.
      </>
    );
  } else if (access.isReadOnly && (access.graceDaysRemaining != null || access.orgStatus === 'GRACE')) {
    Icon = AlertTriangle;
    message = (
      <>
        Grace period
        {access.graceDaysRemaining != null ? `, ${access.graceDaysRemaining}d left` : ''}
        — vault is read-only until upgraded.
      </>
    );
  } else if (
    access.orgStatus === 'TRIAL' &&
    access.trialDaysRemaining != null &&
    access.trialDaysRemaining <= 7
  ) {
    Icon = Clock;
    tone = 'border-primary/20 bg-primary/[0.07] text-primary';
    message = (
      <>
        Trial for <span className="font-semibold">{access.orgName}</span>:{' '}
        {access.trialDaysRemaining} day{access.trialDaysRemaining === 1 ? '' : 's'} left.
      </>
    );
  }

  if (!message) return null;

  return (
    <div className={`border-b px-6 py-2 ${tone.replace('text-warning', '').replace('text-primary', '')}`}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-2.5 text-sm">
        <Icon size={15} className={`shrink-0 ${tone.includes('primary') ? 'text-primary' : 'text-warning'}`} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-foreground">{message}</p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          aria-label="Dismiss notice"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
