'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  AuthAlert,
  AuthBlock,
  AuthHeading,
  AuthInput,
  AuthPage,
  AuthSubmit,
  PasswordInput,
} from '@/components/auth/AuthUi';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        // Worded like the API response: it doesn't confirm whether the account exists.
        toast.success('If that email has an account, a reset code is on its way.');
        setStep(2);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send reset code');
      }
    } catch {
      setError('An error occurred');
    }
    setLoading(false);
  };

  const verifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword: password }),
      });
      if (res.ok) {
        toast.success('Password reset successful');
        setTimeout(() => router.push('/auth/signin'), 2000);
      } else {
        const data = await res.json();
        setError(data.error || 'Reset failed');
      }
    } catch {
      setError('An error occurred');
    }
    setLoading(false);
  };

  const backToSignIn = (
    <AuthBlock className="mt-8 text-center text-sm">
      <Link href="/auth/signin" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
        <ArrowLeft size={14} /> Back to sign in
      </Link>
    </AuthBlock>
  );

  if (step === 1) {
    return (
      <AuthPage key="request">
        <AuthHeading icon={LockKeyhole} title="Reset your password">
          Enter your email and we&apos;ll send you a 6-digit reset code.
        </AuthHeading>

        <form onSubmit={requestReset} className="mt-8 space-y-5" aria-busy={loading}>
          <AuthAlert>{error}</AuthAlert>

          <AuthBlock>
            <label htmlFor="email" className="label">Email</label>
            <AuthInput
              id="email"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
            />
          </AuthBlock>

          <AuthBlock>
            <AuthSubmit loading={loading} loadingLabel="Sending...">
              Send reset code
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </AuthSubmit>
          </AuthBlock>
        </form>

        {backToSignIn}
      </AuthPage>
    );
  }

  const passwordsMismatch = confirmPassword !== '' && password !== confirmPassword;

  return (
    <AuthPage key="verify">
      <AuthHeading icon={MailCheck} title="Check your email">
        Enter the code sent to <span className="font-medium text-foreground">{email}</span> and choose a new
        password.
      </AuthHeading>

      <form onSubmit={verifyReset} className="mt-8 space-y-5" aria-busy={loading}>
        <AuthAlert>{error}</AuthAlert>

        <AuthBlock>
          <label htmlFor="otp" className="label">Reset code</label>
          <AuthInput
            id="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            // indent offsets the trailing letter-spacing so the digits sit centred
            className="text-center indent-[0.5em] font-mono text-lg tracking-[0.5em] sm:text-lg"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            autoFocus
            required
          />
        </AuthBlock>

        <AuthBlock>
          <label htmlFor="password" className="label">New password</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </AuthBlock>

        <AuthBlock>
          <label htmlFor="confirmPassword" className="label">Confirm password</label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            invalid={passwordsMismatch}
            aria-describedby={passwordsMismatch ? 'confirm-password-hint' : undefined}
            required
          />
          {passwordsMismatch && (
            <p id="confirm-password-hint" className="mt-1.5 text-xs text-destructive">
              Passwords do not match
            </p>
          )}
        </AuthBlock>

        <AuthBlock>
          <AuthSubmit loading={loading} loadingLabel="Resetting...">
            Reset password
          </AuthSubmit>
        </AuthBlock>
      </form>

      <AuthBlock className="mt-6 text-center text-sm text-muted-foreground">
        Didn&apos;t get a code?{' '}
        <button
          type="button"
          onClick={() => { setStep(1); setOtp(''); setError(''); }}
          className="font-medium text-primary hover:underline"
        >
          Try a different email
        </button>
      </AuthBlock>

      {backToSignIn}
    </AuthPage>
  );
}
