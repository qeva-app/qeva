'use client';

import { History, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function QevaWordmark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex select-none items-baseline', className)} role="img" aria-label="Qeva">
      <span
        aria-hidden
        className={cn(
          'font-display text-3xl font-bold tracking-tight',
          onDark ? 'text-white' : 'text-foreground'
        )}
      >
        qeva
      </span>
      <span
        aria-hidden
        className={cn(
          'ml-0.5 font-display text-4xl font-bold leading-none',
          onDark ? 'text-emerald-400' : 'text-emerald-500'
        )}
      >
        .
      </span>
    </span>
  );
}

const HIGHLIGHTS: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: 'AES-256-GCM encryption' },
  { icon: Users, label: 'Role-based access' },
  { icon: History, label: 'Full audit trail' },
];

/** Brand panel shown beside auth forms on large screens. */
export default function AuthShowcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-sidebar text-white dark:border-r dark:border-white/5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <QevaWordmark onDark className="relative" />

      <div className="relative max-w-xl py-10">
        <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-5xl xl:leading-[1.1]">
          One vault for every credential your team relies on.
        </h2>
        <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
          Encrypted at rest, shared by role, and logged on every access.
        </p>
      </div>

      <ul className="relative flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/65">
        {HIGHLIGHTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2">
            <Icon size={16} className="text-white/50" />
            {label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
