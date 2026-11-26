'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession, signIn, useSession } from 'next-auth/react';
import { ArrowBigUpDash, BookOpen, Loader2, Mail, ShieldCheck } from 'lucide-react';
import {
  AuthAlert,
  AuthBlock,
  AuthHeading,
  AuthInput,
  AuthPage,
  AuthSubmit,
  PasswordInput,
} from '@/components/auth/AuthUi';

interface SsoProvider {
  id: string;
  provider: string;
  authProviderId: string;
  displayName: string;
}

interface SignInError {
  message: string;
  action?: { label: string; href: string };
}

// Error codes NextAuth appends as ?error= when it sends the user back here.
const REDIRECT_ERRORS: Record<string, string> = {
  SessionRequired: 'Please sign in to continue.',
  OAuthAccountNotLinked: 'This email is already registered with a different sign-in method.',
  AccessDenied: 'Access denied. Contact your administrator.',
};

// Thrown by `authorize` in src/lib/auth.ts when it can't open the encrypted credentials.
const DECRYPT_FAILED = 'CREDENTIALS_DECRYPT_FAILED';

/** Maps the error thrown by `authorize` in src/lib/auth.ts to what the user sees. */
function describeSignInError(code: string, email: string): SignInError {
  switch (code) {
    case 'EMAIL_NOT_VERIFIED':
      return {
        message: 'Your email address has not been verified yet.',
        action: { label: 'Verify email', href: `/auth/verify?email=${encodeURIComponent(email)}` },
      };
    case 'ACCOUNT_DEACTIVATED':
      return { message: 'This account has been deactivated. Contact your administrator.' };
    case DECRYPT_FAILED:
      return { message: "We couldn't secure your sign-in. Refresh the page and try again." };
    case 'MFA_INVALID':
      return { message: 'Invalid authenticator code. Try again.' };
    case 'MFA_BACKUP_USED':
      return {
        message:
          'This backup code has already been used or is not valid. Each backup code works only once.',
      };
    default:
      return { message: 'Invalid email or password.' };
  }
}

/**
 * Encrypts the credentials and submits them; they never leave the browser in plaintext.
 * If the server can't decrypt them (its key changed since this page cached it),
 * fetches the current key and tries once more.
 */
async function submitCredentials(email: string, password: string, totp?: string) {
  const { encryptCredentials, resetPublicKey } = await import('@/lib/client-crypto');
  for (let attempt = 1; ; attempt++) {
    const payload = await encryptCredentials(email, password, totp);
    const result = await signIn('credentials', { payload, redirect: false });
    if (result?.error !== DECRYPT_FAILED || attempt === 2) return result;
    resetPublicKey();
  }
}

/** Where to go after sign-in: ?callbackUrl= if it stays on this origin, otherwise home. */
function getCallbackUrl(): string {
  const raw = new URLSearchParams(window.location.search).get('callbackUrl');
  if (!raw) return '/vault';
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.startsWith('/auth/')) return '/vault';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/vault';
  }
}

function postAuthDestination(user?: {
  mustChangePassword?: boolean;
  mfaPromptPending?: boolean;
  twoFactorEnabled?: boolean;
} | null) {
  if (user?.mustChangePassword) return '/auth/change-password';
  if (user?.mfaPromptPending && !user.twoFactorEnabled) return '/auth/setup-mfa';
  return getCallbackUrl();
}

export default function SignInPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ssoPending, setSsoPending] = useState<string | null>(null);
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const passwordRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);
  // True once this page has signed the user in itself, so the effect below
  // doesn't race the redirect.
  const justSignedIn = useRef(false);

  const busy = loading || ssoPending !== null;

  const showError = (next: SignInError) => {
    setError(next);
    setErrorCount((n) => n + 1);
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && !justSignedIn.current) {
      router.replace(postAuthDestination(session?.user));
    }
  }, [status, session, router]);

  // Pre-warm RSA public key and CSRF, load SSO providers, surface redirect errors
  useEffect(() => {
    import('@/lib/client-crypto').then((m) => m.preWarmPublicKey()).catch(() => {});
    fetch('/api/auth/csrf').catch(() => {});
    fetch('/api/sso/providers')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSsoProviders(data); })
      .catch(() => {});

    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError({ message: REDIRECT_ERRORS[code] ?? 'Sign-in failed. Please try again.' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || busy) return;
    if (mfaStep && !totp) return;

    setLoading(true);
    setError(null);

    try {
      const result = await submitCredentials(email, password, mfaStep ? totp : undefined);

      if (result?.error === 'MFA_REQUIRED') {
        setMfaStep(true);
        setLoading(false);
        requestAnimationFrame(() => totpRef.current?.focus());
        return;
      }

      if (result?.error) {
        showError(describeSignInError(result.error, email));
        setLoading(false);
        if (mfaStep) {
          totpRef.current?.focus();
          totpRef.current?.select();
        } else {
          passwordRef.current?.focus();
          passwordRef.current?.select();
        }
        return;
      }

      justSignedIn.current = true;
      const nextSession = await getSession();
      router.replace(postAuthDestination(nextSession?.user));
    } catch {
      // Web Crypto only exists on secure origins (HTTPS or localhost)
      showError({
        message: window.isSecureContext
          ? 'Something went wrong. Please try again.'
          : 'Signing in requires a secure (HTTPS) connection.',
      });
      setLoading(false);
    }
  };

  const handleSso = (sso: SsoProvider) => {
    setSsoPending(sso.id);
    signIn(sso.authProviderId || 'azuread', { callbackUrl: getCallbackUrl() });
  };

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  return (
      <AuthPage>
        <AuthHeading title="Sign in to Qeva">
          {mfaStep
            ? 'Enter the code from your authenticator app or a backup code.'
            : 'Open your personal vault.'}
        </AuthHeading>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={loading}>
          <AuthAlert shakeKey={errorCount}>
            {error && (
              <>
                {error.message}
                {error.action && (
                  <>
                    {' '}
                    <Link href={error.action.href} className="font-semibold underline underline-offset-2">
                      {error.action.label}
                    </Link>
                  </>
                )}
              </>
            )}
          </AuthAlert>

          <AuthBlock>
            <label htmlFor="email" className="label">Email</label>
            <AuthInput
              id="email"
              name="email"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              disabled={mfaStep}
            />
          </AuthBlock>

          <AuthBlock>
            <label htmlFor="password" className="label">Password</label>
            <PasswordInput
              ref={passwordRef}
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={trackCapsLock}
              onKeyUp={trackCapsLock}
              onBlur={() => setCapsLockOn(false)}
              placeholder="Enter password"
              autoComplete="current-password"
              aria-describedby={capsLockOn ? 'caps-lock-hint' : undefined}
              required
              disabled={mfaStep}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p
                id="caps-lock-hint"
                role="status"
                className="flex min-h-[1.25rem] items-center gap-1.5 text-xs font-medium text-warning"
              >
                {capsLockOn && (
                  <>
                    <ArrowBigUpDash size={14} aria-hidden /> Caps Lock is on
                  </>
                )}
              </p>
              <Link href="/auth/reset-password" className="shrink-0 text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          </AuthBlock>

          {mfaStep && (
            <AuthBlock>
              <label htmlFor="totp" className="label">Authenticator code</label>
              <AuthInput
                ref={totpRef}
                id="totp"
                name="totp"
                type="text"
                icon={ShieldCheck}
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </AuthBlock>
          )}

          <AuthBlock>
            <AuthSubmit loading={loading} loadingLabel="Signing in..." disabled={busy}>
              {mfaStep ? 'Verify & sign in' : 'Sign in'}
            </AuthSubmit>
          </AuthBlock>
        </form>

        {/* SSO Providers */}
        {ssoProviders.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or continue with
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-4 space-y-2">
              {ssoProviders.map((sso) => (
                <button
                  key={sso.id}
                  type="button"
                  onClick={() => handleSso(sso)}
                  disabled={busy}
                  className="btn-outline h-11 w-full"
                >
                  {ssoPending === sso.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} className="text-muted-foreground" />
                  )}
                  {sso.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        <AuthBlock className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </AuthBlock>

        <AuthBlock className="mt-4 flex justify-center">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <BookOpen size={15} aria-hidden />
            Documentation
          </Link>
        </AuthBlock>

        <AuthBlock className="mt-10 text-center text-xs text-muted-foreground">
          <ShieldCheck size={14} aria-hidden className="mr-1.5 inline-block align-[-2px]" />
          Sessions sign out automatically after 30 minutes of inactivity.
        </AuthBlock>
      </AuthPage>
  );
}
