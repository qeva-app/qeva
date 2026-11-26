import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('motion-page space-y-6', className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow: _eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Ignored - kept so existing call sites compile. */
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
