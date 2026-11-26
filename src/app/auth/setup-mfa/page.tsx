'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  AuthAlert,
  AuthBlock,
  AuthHeading,
  AuthInput,
  AuthPage,
  AuthSubmit,
} from '@/components/auth/AuthUi';

type Step = 'offer' | 'enroll' | 'backup' | 'skipped';

export default function SetupMfaPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>('offer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }
    if (status !== 'authenticated') return;
    if (session?.user?.mustChangePassword) {
      router.replace('/auth/change-password');
      return;
    }
    if (session?.user?.twoFactorEnabled || !session?.user?.mfaPromptPending) {
      if (step === 'offer' || step === 'enroll') router.replace('/vault');
    }
  }, [status, session, router, step]);

  const finish = async (mfaPromptPending: boolean, twoFactorEnabled?: boolean) => {
    await update({
      mfaPromptPending,
      ...(typeof twoFactorEnabled === 'boolean' ? { twoFactorEnabled } : {}),
    });
    router.replace('/vault');
  };

  const startSetup = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/mfa/setup', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start MFA setup');
      setQr(data.qr);
      setSecret(data.secret);
      setCode('');
      setStep('enroll');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not start MFA setup');
    }
    setBusy(false);
  };

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
      setStep('backup');
      toast.success('Two-factor authentication enabled');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not enable MFA');
    }
    setBusy(false);
  };

  const skip = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/mfa/skip', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not skip');
      setStep('skipped');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not skip');
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  if (status === 'loading' || status === 'unauthenticated') return null;

  if (step === 'skipped') {
    return (
      <AuthPage>
        <AuthHeading icon={ShieldCheck} title="MFA skipped for now">
          You can turn on two-factor authentication anytime from{' '}
          <Link href="/settings" className="font-medium text-primary hover:underline">
            Settings → Two-factor authentication
          </Link>
          .
        </AuthHeading>
        <AuthBlock className="mt-8">
          <button
            type="button"
            className="btn-primary h-11 w-full font-semibold"
            onClick={() => finish(false)}
          >
            Continue to Qeva
            <ArrowRight size={16} className="ml-2 inline" />
          </button>
        </AuthBlock>
      </AuthPage>
    );
  }

  if (step === 'backup') {
    return (
      <AuthPage>
        <AuthHeading icon={ShieldCheck} title="Save your backup codes">
          Store these offline. Each code works once if you lose your authenticator.
        </AuthHeading>
        <ul className="mt-6 grid grid-cols-2 gap-2 font-mono text-sm">
          {backupCodes.map((c) => (
            <li key={c} className="rounded-md border border-border bg-muted/40 px-3 py-2">
              {c}
            </li>
          ))}
        </ul>
        <AuthBlock className="mt-8">
          <button
            type="button"
            className="btn-primary h-11 w-full font-semibold"
            onClick={() => finish(false, true)}
          >
            I saved them — continue
            <ArrowRight size={16} className="ml-2 inline" />
          </button>
        </AuthBlock>
      </AuthPage>
    );
  }

  if (step === 'enroll') {
    return (
      <AuthPage>
        <AuthHeading icon={ShieldCheck} title="Scan with your authenticator">
          Use an app like Google Authenticator, 1Password, or Authy, then enter the 6-digit code.
        </AuthHeading>
        <form onSubmit={enable} className="mt-8 space-y-5" aria-busy={busy}>
          <AuthAlert>{error}</AuthAlert>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="MFA QR code"
              className="mx-auto h-[200px] w-[200px] rounded-lg border border-border"
            />
          )}
          {secret && (
            <p className="break-all text-xs text-muted-foreground">
              Manual key: <span className="font-mono">{secret}</span>
            </p>
          )}
          <AuthBlock>
            <label htmlFor="code" className="label">
              6-digit code
            </label>
            <AuthInput
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
            />
          </AuthBlock>
          <AuthSubmit loading={busy} loadingLabel="Verifying…" disabled={code.length < 6}>
            Verify & enable
          </AuthSubmit>
          <button
            type="button"
            className="btn-ghost h-11 w-full"
            disabled={busy}
            onClick={() => {
              setQr(null);
              setSecret(null);
              setStep('offer');
            }}
          >
            Back
          </button>
        </form>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthHeading icon={ShieldCheck} title="Protect your account">
        Two-factor authentication adds a code from your phone after your password. Recommended for
        vault access.
      </AuthHeading>
      <div className="mt-8 space-y-3">
        <AuthAlert>{error}</AuthAlert>
        <button
          type="button"
          className="btn-primary h-11 w-full font-semibold"
          disabled={busy}
          onClick={startSetup}
        >
          {busy ? 'Preparing…' : 'Set up authenticator'}
        </button>
        <button type="button" className="btn-ghost h-11 w-full" disabled={busy} onClick={skip}>
          Skip for now
        </button>
      </div>
    </AuthPage>
  );
}
