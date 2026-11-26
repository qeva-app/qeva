'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, ChevronRight, Mail, User, UserPlus, type LucideIcon } from 'lucide-react';
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
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';

type SignupType = 'individual' | 'company';

const SIGNUP_TYPES: { type: SignupType; icon: LucideIcon; title: string; description: string }[] = [
  { type: 'individual', icon: User, title: 'Individual', description: 'Free personal vault for your passwords' },
  { type: 'company', icon: Building2, title: 'Company', description: 'Team vaults, SSO, compliance & more' },
];

const PUBLIC_EMAIL_DOMAINS = /gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|protonmail\.com/i;

export default function RegisterClient({ allowCompany }: { allowCompany: boolean }) {
  const router = useRouter();
  // Community / Docker: skip the chooser and go straight to individual signup.
  const [signupType, setSignupType] = useState<SignupType | null>(allowCompany ? null : 'individual');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'password') {
      let s = 0;
      if (value.length >= 8) s += 20;
      if (value.length >= 12) s += 10;
      if (value.length >= 16) s += 10;
      if (/[A-Z]/.test(value)) s += 15;
      if (/[a-z]/.test(value)) s += 10;
      if (/[0-9]/.test(value)) s += 15;
      if (/[^A-Za-z0-9]/.test(value)) s += 20;
      setStrength(Math.min(100, s));
    }
  };

  const completionPct = () => {
    let count = 0;
    if (form.firstName) count++;
    if (form.lastName) count++;
    if (form.email) count++;
    if (form.password && strength >= 40) count++;
    if (form.confirmPassword && form.password === form.confirmPassword) count++;
    if (signupType === 'company' && form.companyName) count++;
    const total = signupType === 'company' ? 6 : 5;
    return Math.round((count / total) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          signupType: allowCompany ? signupType : 'individual',
          companyName: allowCompany && signupType === 'company' ? form.companyName : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.success(
          data.emailSent
            ? 'Registration successful! Check your email for a verification code.'
            : 'Registration successful! Check your email for a verification code (or your local OTP setup if email is off).'
        );
        router.push(`/auth/verify?email=${encodeURIComponent(form.email)}`);
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('An error occurred');
    }
    setLoading(false);
  };

  const signInPrompt = (
    <AuthBlock className="mt-8 text-center text-sm text-muted-foreground">
      Already have an account?{' '}
      <Link href="/auth/signin" className="font-medium text-primary hover:underline">
        Sign in
      </Link>
    </AuthBlock>
  );

  if (allowCompany && !signupType) {
    return (
      <AuthPage key="choose">
        <AuthHeading icon={UserPlus} title="Create your account">
          Choose how you want to use Qeva.
        </AuthHeading>

        <div className="mt-8 space-y-3">
          {SIGNUP_TYPES.map(({ type, icon: Icon, title, description }) => (
            <AuthBlock key={type}>
              <button
                type="button"
                onClick={() => setSignupType(type)}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-border hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon size={20} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
              </button>
            </AuthBlock>
          ))}
        </div>

        {signInPrompt}
      </AuthPage>
    );
  }

  const passwordsMismatch = form.confirmPassword !== '' && form.password !== form.confirmPassword;
  const completion = completionPct();
  const isCompany = allowCompany && signupType === 'company';

  return (
    <AuthPage key="details">
      {allowCompany && (
        <AuthBlock className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setSignupType(null); setError(''); }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
            {signupType} account
          </span>
        </AuthBlock>
      )}

      <AuthHeading icon={isCompany ? Building2 : User} title="Create your account">
        {isCompany ? 'Set up Qeva for your team.' : 'Set up your personal vault.'}
      </AuthHeading>

      <AuthBlock className="mt-6">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{completion}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Form completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completion}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${completion}%` }} />
        </div>
      </AuthBlock>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5" aria-busy={loading}>
        <AuthAlert>{error}</AuthAlert>

        {isCompany && (
          <AuthBlock>
            <label htmlFor="companyName" className="label">Company name</label>
            <AuthInput
              id="companyName"
              icon={Building2}
              value={form.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder="Acme Corp"
              autoComplete="organization"
              autoFocus
              required
            />
          </AuthBlock>
        )}

        <AuthBlock className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="label">First name</label>
            <AuthInput
              id="firstName"
              value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              autoComplete="given-name"
              autoFocus={!isCompany}
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="label">Last name</label>
            <AuthInput
              id="lastName"
              value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>
        </AuthBlock>

        <AuthBlock>
          <label htmlFor="email" className="label">Email</label>
          <AuthInput
            id="email"
            type="email"
            icon={Mail}
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder={isCompany ? 'you@yourcompany.com' : 'you@email.com'}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          {isCompany && form.email && PUBLIC_EMAIL_DOMAINS.test(form.email) && (
            <p className="mt-1.5 text-xs text-warning">
              Please use your company email. Public email domains are not allowed for company signup.
            </p>
          )}
        </AuthBlock>

        <AuthBlock>
          <label htmlFor="password" className="label">Password</label>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
          {form.password && (
            <div className="mt-2">
              <PasswordStrengthIndicator score={strength} size="sm" />
            </div>
          )}
        </AuthBlock>

        <AuthBlock>
          <label htmlFor="confirmPassword" className="label">Confirm password</label>
          <PasswordInput
            id="confirmPassword"
            value={form.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
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
          <AuthSubmit loading={loading} loadingLabel="Creating account...">
            Create account
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </AuthSubmit>
        </AuthBlock>
      </form>

      {signInPrompt}
    </AuthPage>
  );
}
