'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AuthAlert, AuthBlock, AuthHeading, AuthPage } from '@/components/auth/AuthUi';

const CODE_LIFETIME_SECONDS = 300; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 30;

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const viaConsole = searchParams.get('via') === 'console';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(CODE_LIFETIME_SECONDS);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit
    if (index === 5 && value) {
      const code = newOtp.join('');
      if (code.length === 6) verifyOtp(code);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    text.split('').forEach((char, i) => { if (i < 6) newOtp[i] = char; });
    setOtp(newOtp);
    if (text.length === 6) verifyOtp(text);
  };

  const verifyOtp = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.success(
          data.emailVerified
            ? 'Email verified! Redirecting...'
            : 'Account unlocked! Redirecting...'
        );
        setTimeout(() => router.push('/auth/signin'), 1500);
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid OTP');
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      }
    } catch {
      setError('Verification failed');
    }
    setLoading(false);
  };

  const resendOtp = async () => {
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.success(
          data.emailSent
            ? 'OTP resent'
            : 'New setup code written to server logs (QEVA_SETUP_OTP)'
        );
        setTimer(CODE_LIFETIME_SECONDS);
      } else {
        toast.error('Failed to resend');
      }
    } catch {
      toast.error('Failed to resend');
    }
    setResending(false);
  };

  const formatTimer = () => {
    const m = Math.floor(timer / 60);
    const s = timer % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const backToSignIn = (
    <AuthBlock className="mt-8 text-center text-sm">
      <Link href="/auth/signin" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
        <ArrowLeft size={14} /> Back to sign in
      </Link>
    </AuthBlock>
  );

  if (!email) {
    return (
      <AuthPage>
        <AuthHeading icon={MailCheck} title="Verify your email">
          This link is missing an email address. Sign in and we&apos;ll point you back here if your email still
          needs verifying.
        </AuthHeading>
        {backToSignIn}
      </AuthPage>
    );
  }

  const resendWait = timer - (CODE_LIFETIME_SECONDS - RESEND_COOLDOWN_SECONDS);

  return (
    <AuthPage>
      <AuthHeading icon={MailCheck} title={viaConsole ? 'Enter setup code' : 'Verify your email'}>
        {viaConsole ? (
          <>
            SMTP is not configured. Enter the 6-digit <span className="font-medium text-foreground">QEVA_SETUP_OTP</span>{' '}
            from the server logs for{' '}
            <span className="block break-all font-medium text-foreground">{email}</span>
          </>
        ) : (
          <>
            Enter the 6-digit code sent to{' '}
            <span className="block break-all font-medium text-foreground">{email}</span>
          </>
        )}
      </AuthHeading>

      <div className="mt-8 space-y-5">
        <AuthAlert>{error}</AuthAlert>

        <AuthBlock>
          <div role="group" aria-label="Verification code" className="grid grid-cols-6 gap-2" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${i + 1}`}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-14 w-full rounded-xl border border-input bg-background text-center text-xl font-semibold text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                disabled={loading}
              />
            ))}
          </div>
        </AuthBlock>

        <AuthBlock className="text-center">
          <p className="flex min-h-[1.25rem] items-center justify-center gap-2 text-sm text-muted-foreground">
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Verifying...
              </>
            ) : timer > 0 ? (
              <>
                Code expires in <span className="font-mono tabular-nums text-foreground">{formatTimer()}</span>
              </>
            ) : (
              'Code expired'
            )}
          </p>
          <button
            type="button"
            onClick={resendOtp}
            disabled={resending || resendWait > 0}
            className="mx-auto mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
            {resending ? 'Sending...' : resendWait > 0 ? `Resend code in ${resendWait}s` : 'Resend code'}
          </button>
        </AuthBlock>
      </div>

      {backToSignIn}
    </AuthPage>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}
