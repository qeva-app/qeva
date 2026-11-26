'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';

export default function MfaSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const refresh = () =>
    fetch('/api/profile/mfa/status')
      .then((r) => r.json())
      .then((d) => {
        setEnabled(!!d.enabled);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/profile/mfa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');
      setQr(data.qr);
      setSecret(data.secret);
      setCode('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Setup failed');
    }
    setBusy(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/profile/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enable failed');
      toast.success('Two-factor authentication enabled');
      setQr(null);
      setSecret(null);
      setCode('');
      setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : null);
      setEnabled(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Enable failed');
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/profile/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disable failed');
      toast.success('Two-factor authentication disabled');
      setDisableCode('');
      setEnabled(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Disable failed');
    }
    setBusy(false);
  };

  if (loading) return null;

  return (
    <AnimatedCard className="p-6">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <ShieldCheck size={20} /> Two-factor authentication
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Require a one-time code from an authenticator app after your password.
      </p>

      {backupCodes && (
        <div className="mb-4 p-3 rounded-lg border border-warning/30 bg-warning/5 space-y-2">
          <p className="text-sm font-medium text-foreground">
            Save these backup codes now — they won&apos;t be shown again.
          </p>
          <ul className="font-mono text-xs grid grid-cols-2 gap-1">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setBackupCodes(null)}>
            I saved them
          </button>
        </div>
      )}

      {enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-success font-medium">MFA is enabled on your account.</p>
          <p className="text-xs text-muted-foreground">
            Sign-in accepts an authenticator code or a one-time backup code.
          </p>
          <input
            className="input"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="Authenticator code to disable"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <button type="button" className="btn-destructive" disabled={busy} onClick={disable}>
            {busy ? 'Working…' : 'Disable MFA'}
          </button>
        </div>
      ) : qr ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="MFA QR code" className="rounded-lg border border-border w-[200px] h-[200px]" />
          {secret && (
            <p className="text-xs text-muted-foreground break-all">
              Manual key: <span className="font-mono">{secret}</span>
            </p>
          )}
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={busy || code.length < 6} onClick={enable}>
              Verify & enable
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setQr(null);
                setSecret(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary" disabled={busy} onClick={startSetup}>
          {busy ? 'Preparing…' : 'Set up authenticator'}
        </button>
      )}
    </AnimatedCard>
  );
}
