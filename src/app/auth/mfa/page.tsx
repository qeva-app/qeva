'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ShieldCheck } from 'lucide-react';
import {
  AuthAlert,
  AuthBlock,
  AuthHeading,
  AuthInput,
  AuthPage,
  AuthSubmit,
} from '@/components/auth/AuthUi';

export default function MfaChallengePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin');
    if (status === 'authenticated' && session?.user?.mfaVerified) {
      router.replace('/vault');
    }
  }, [status, session, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Invalid code');
        setLoading(false);
        return;
      }
      // Refresh JWT so hasValidMfaCookie is picked up
      await update();
      router.replace('/vault');
      router.refresh();
    } catch {
      setError('Something went wrong');
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <AuthPage>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthHeading icon={ShieldCheck} title="Two-factor authentication">
        Enter a code from your authenticator app or a backup code to continue.
      </AuthHeading>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <AuthAlert>{error}</AuthAlert>
        <AuthBlock>
          <label htmlFor="mfa-code" className="label">
            Verification code
          </label>
          <AuthInput
            id="mfa-code"
            icon={ShieldCheck}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit or backup code"
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </AuthBlock>
        <AuthBlock>
          <AuthSubmit loading={loading} loadingLabel="Verifying...">
            Verify
          </AuthSubmit>
        </AuthBlock>
      </form>
    </AuthPage>
  );
}
