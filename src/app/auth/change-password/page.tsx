'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import {
  AuthAlert,
  AuthHeading,
  AuthPage,
  AuthSubmit,
  PasswordInput,
} from '@/components/auth/AuthUi';

export default function ChangePasswordPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }
    if (status === 'authenticated' && !session?.user?.mustChangePassword) {
      router.replace(
        session?.user?.mfaPromptPending && !session.user.twoFactorEnabled
          ? '/auth/setup-mfa'
          : '/vault'
      );
    }
  }, [status, session, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not update password');
        setLoading(false);
        return;
      }
      const promptMfa = !!data.mfaPromptPending || !!session?.user?.mfaPromptPending;
      await update({ mustChangePassword: false, mfaPromptPending: promptMfa });
      toast.success('Password updated');
      router.replace(promptMfa ? '/auth/setup-mfa' : '/vault');
    } catch {
      setError('An error occurred');
      setLoading(false);
    }
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return null;
  }

  return (
    <AuthPage>
      <AuthHeading icon={LockKeyhole} title="Set a new password">
        You signed in with a one-time bootstrap password. Choose your own before continuing.
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" aria-busy={loading}>
        <AuthAlert>{error}</AuthAlert>

        <div>
          <label htmlFor="current" className="label">
            Current password
          </label>
          <PasswordInput
            id="current"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="new" className="label">
            New password
          </label>
          <PasswordInput
            id="new"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="label">
            Confirm new password
          </label>
          <PasswordInput
            id="confirm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <AuthSubmit
          loading={loading}
          loadingLabel="Saving…"
          disabled={!currentPassword || !newPassword || !confirmPassword}
        >
          Save password
          <ArrowRight size={16} />
        </AuthSubmit>
      </form>
    </AuthPage>
  );
}
