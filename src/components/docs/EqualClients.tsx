'use client';

import { Bot, Link2, User } from 'lucide-react';

/** Visual for “humans and agents share one vault ACL”. */
export function EqualClients({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3 border-b border-border p-4 sm:border-b-0 sm:border-r">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Human client</p>
              <p className="font-mono text-[11px] text-muted-foreground">clientKind: HUMAN</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/40 px-4 py-3 sm:border-b-0 sm:border-r sm:px-5">
            <Link2 className="h-4 w-4 text-emerald-500" aria-hidden />
            <span className="text-xs font-medium text-foreground">same ACL</span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
              <Bot className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Agent client</p>
              <p className="font-mono text-[11px] text-muted-foreground">clientKind: AGENT</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-[#0b1220] px-4 py-3">
          <div>
            <p className="text-[11px] text-slate-400">Shared vault surface</p>
            <p className="font-display text-sm font-semibold text-white">scopes, encryption, audit</p>
          </div>
          <p className="font-display text-lg font-bold tracking-tight text-white">
            qeva<span className="text-emerald-400">.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
