'use client';

import { forwardRef, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Wraps an auth page's content. */
export function AuthPage({ children }: { children: React.ReactNode }) {
  return <div className="motion-page">{children}</div>;
}

export function AuthBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function AuthHeading({
  icon: _Icon,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AuthBlock>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </AuthBlock>
  );
}

/** Error banner. Renders nothing without children. */
export function AuthAlert({ children, shakeKey = 0 }: { children?: React.ReactNode; shakeKey?: number }) {
  if (!children) return null;
  return (
    <div
      key={shakeKey}
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

type AuthInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon;
  /** Element overlaid on the right edge of the input, e.g. a show/hide button. */
  trailing?: React.ReactNode;
  invalid?: boolean;
};

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { icon: Icon, trailing, invalid, className, ...props },
  ref
) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        // 16px text on phones stops iOS zooming the page when a field is focused
        className={cn(
          'input h-11 text-base sm:text-sm',
          Icon ? 'pl-10' : undefined,
          trailing ? 'pr-11' : undefined,
          invalid ? 'border-destructive focus:border-destructive focus:ring-destructive' : undefined,
          className
        )}
        {...props}
      />
      {trailing}
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<AuthInputProps, 'type' | 'trailing'>>(
  function PasswordInput({ icon = Lock, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <AuthInput
        ref={ref}
        icon={icon}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
        {...props}
      />
    );
  }
);

export function AuthSubmit({
  loading,
  loadingLabel,
  disabled,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="submit" disabled={loading || disabled} className="btn-primary h-11 w-full font-semibold">
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" /> {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
