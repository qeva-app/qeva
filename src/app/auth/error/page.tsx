'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { AuthBlock, AuthHeading, AuthPage } from '@/components/auth/AuthUi';

// The codes NextAuth sends to its error page as ?error=. Anything else gets the
// default text; the raw query value is never rendered.
const ERRORS: Record<string, { title: string; message: string }> = {
  Configuration: {
    title: 'Sign-in unavailable',
    message: 'Sign-in is not set up correctly on the server. Try again later or contact your administrator.',
  },
  AccessDenied: {
    title: 'Access denied',
    message: 'You do not have permission to sign in. Contact your administrator if you think this is a mistake.',
  },
  Verification: {
    title: 'Link expired',
    message: 'This sign-in link has expired or has already been used. Request a new one to continue.',
  },
};

const DEFAULT_ERROR = {
  title: 'Sign-in failed',
  message: 'Something went wrong while signing you in. Please try again.',
};

function ErrorContent() {
  const code = useSearchParams().get('error') ?? '';
  const known = Object.hasOwn(ERRORS, code);
  const { title, message } = known ? ERRORS[code] : DEFAULT_ERROR;

  return (
    <AuthPage>
      <AuthHeading icon={ShieldAlert} title={title}>
        {message}
      </AuthHeading>

      <AuthBlock className="mt-8 space-y-3">
        <Link href="/auth/signin" className="btn-primary h-11 w-full font-semibold">
          <ArrowLeft size={16} /> Back to sign in
        </Link>
        <Link href="/docs/support" className="btn-outline h-11 w-full">
          Get help
        </Link>
      </AuthBlock>

      {known && (
        <AuthBlock className="mt-8 text-center font-mono text-xs text-muted-foreground">
          Error code: {code}
        </AuthBlock>
      )}
    </AuthPage>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
