'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  AuthAlert,
  AuthBlock,
  AuthHeading,
  AuthPage,
  AuthSubmit,
  PasswordInput,
} from '@/components/auth/AuthUi';

function ActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (!email || !token) {
      setLinkError('This activation link is missing details. Ask your admin to invite you again.');
      setChecking(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/auth/activate?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setLinkError(data.error || 'This invite link is invalid or expired');
          return;
        }
        setName(data.name || '');
        setOrgName(data.orgName || null);
      })
      .catch(() => {
        if (!cancelled) setLinkError('Could not validate this invite link');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Activation failed');
        return;
      }
      toast.success('Account activated - sign in with your new password');
      router.push('/auth/signin');
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthPage>
        <AuthHeading title="Activating…">Checking your invite link.</AuthHeading>
      </AuthPage>
    );
  }

  if (linkError) {
    return (
      <AuthPage>
        <AuthHeading icon={MailCheck} title="Invite unavailable">
          {linkError}
        </AuthHeading>
        <AuthBlock className="mt-8 text-center text-sm">
          <Link href="/auth/signin" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </AuthBlock>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthHeading icon={MailCheck} title="Activate your account">
        {name ? `Welcome, ${name}. ` : ''}
        {orgName ? `Join ${orgName} on Qeva by setting a password.` : 'Set a password to finish joining Qeva.'}
      </AuthHeading>

      <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={loading}>
        <AuthAlert>{error}</AuthAlert>

        <AuthBlock>
          <label className="label">Email</label>
          <p className="input bg-muted text-muted-foreground cursor-default">{email}</p>
        </AuthBlock>

        <AuthBlock>
          <label htmlFor="password" className="label">Password</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
          />
        </AuthBlock>

        <AuthBlock>
          <label htmlFor="confirm" className="label">Confirm password</label>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </AuthBlock>

        <AuthSubmit loading={loading} loadingLabel="Activating...">Activate and continue</AuthSubmit>
      </form>

      <AuthBlock className="mt-8 text-center text-sm">
        <Link href="/auth/signin" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </AuthBlock>
    </AuthPage>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <AuthPage>
          <AuthHeading title="Activating…">Loading…</AuthHeading>
        </AuthPage>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}
