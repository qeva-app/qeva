'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, CheckSquare, Copy, Info, Lightbulb, Square } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export function DocHeader({
  kicker,
  title,
  description,
  actions,
  aside,
}: {
  kicker?: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="relative mb-8 overflow-hidden rounded-xl border border-border bg-muted/30">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary"
        aria-hidden
      />
      <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          {kicker ? <p className="mb-1.5 text-sm font-medium text-primary">{kicker}</p> : null}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
            {title}
          </h1>
          <div className="mt-2.5 max-w-[54ch] text-[15px] leading-7 text-muted-foreground text-pretty">
            {description}
          </div>
          {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </header>
  );
}

export function DocSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('docs-section scroll-mt-28', className)}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          <a
            href={`#${id}`}
            className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title}
          </a>
        </h2>
        <div className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-[15px] leading-7 text-muted-foreground sm:p-5 [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: 'info' | 'tip' | 'warn';
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: 'border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent',
    tip: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent',
    warn: 'border-warning/30 bg-gradient-to-br from-warning/[0.1] to-transparent',
  } as const;
  const iconStyles = {
    info: 'text-primary',
    tip: 'text-emerald-600',
    warn: 'text-warning',
  } as const;
  const Icon = { info: Info, tip: Lightbulb, warn: AlertTriangle }[variant];

  return (
    <aside className={cn('flex gap-3 rounded-xl border px-4 py-3.5 text-sm leading-6 shadow-sm', styles[variant])}>
      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card', iconStyles[variant])}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1 pt-0.5">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <div className="text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </div>
      </div>
    </aside>
  );
}

export function CodeBlock({
  code,
  language = 'bash',
  title,
  className,
}: {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-800 bg-[#0b1220] shadow-[0_12px_40px_-20px_rgba(15,23,42,0.55)]', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-3.5 py-2.5">
        <span className="truncate font-mono text-[11px] text-slate-400">{title || language}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-slate-100">
        <code translate="no">{code}</code>
      </pre>
    </div>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const tone = method.includes('DELETE')
    ? 'bg-rose-500/15 text-rose-300 ring-rose-400/20'
    : method.includes('POST') || method.includes('PUT')
      ? 'bg-amber-500/15 text-amber-200 ring-amber-400/20'
      : 'bg-sky-500/15 text-sky-200 ring-sky-400/20';

  return (
    <span className={cn('inline-flex shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ring-1 ring-inset', tone)}>
      {method}
    </span>
  );
}

/** Light-surface method badge for tables on white */
export function MethodBadgeLight({ method }: { method: string }) {
  const tone = method.includes('DELETE')
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : method.includes('POST') || method.includes('PUT')
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-sky-50 text-sky-700 ring-sky-200';

  return (
    <span className={cn('inline-flex shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ring-1', tone)}>
      {method}
    </span>
  );
}

export function DocTabs({
  tabs,
  defaultValue,
}: {
  tabs: { value: string; label: string; content: ReactNode }[];
  defaultValue?: string;
}) {
  return (
    <Tabs defaultValue={defaultValue || tabs[0]?.value} className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/80 p-1">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4 outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function InteractiveChecklist({
  storageKey,
  items,
}: {
  storageKey: string;
  items: { id: string; label: ReactNode }[];
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const completed = items.filter((i) => done[i.id]).length;
  const pct = (completed / Math.max(items.length, 1)) * 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Checklist</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {completed}/{items.length}
        </p>
      </div>
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul>
        {items.map((item, i) => {
          const checked = !!done[item.id];
          return (
            <li key={item.id} className={cn(i > 0 && 'border-t border-border')}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  checked ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {checked ? (
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={checked ? 'line-through' : undefined}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code
      translate="no"
      className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground ring-1 ring-border/80"
    >
      {children}
    </code>
  );
}

export function EditionBadge({ edition }: { edition: 'community' | 'enterprise' }) {
  const isCe = edition === 'community';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        isCe
          ? 'bg-sky-500/10 text-sky-800 ring-sky-500/20'
          : 'bg-violet-500/10 text-violet-800 ring-violet-500/20'
      )}
    >
      {isCe ? 'Community' : 'Enterprise'}
    </span>
  );
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 text-[15px] leading-7 text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" aria-hidden />
          <span className="min-w-0 [&_strong]:text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-medium text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="bg-card">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-muted-foreground [&_strong]:text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepList({ steps }: { steps: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-medium text-foreground">{step.title}</p>
            <div className="mt-1 text-sm text-muted-foreground">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
