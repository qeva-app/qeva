'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search, Terminal } from 'lucide-react';
import { CodeBlock, MethodBadgeLight } from '@/components/docs/ui';
import { cn } from '@/lib/utils';

export type Endpoint = {
  method: string;
  path: string;
  desc: string;
  scope?: string;
  sample?: string;
};

export function EndpointExplorer({ endpoints }: { endpoints: Endpoint[] }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return endpoints;
    return endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(needle) ||
        e.method.toLowerCase().includes(needle) ||
        e.desc.toLowerCase().includes(needle) ||
        (e.scope ?? '').toLowerCase().includes(needle)
    );
  }, [endpoints, q]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3.5 py-2.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter endpoints…"
          spellCheck={false}
          autoComplete="off"
          name="endpoint-filter"
          aria-label="Filter endpoints"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground ring-1 ring-border">
          {filtered.length}
        </span>
      </div>
      <ul>
        {filtered.map((ep, i) => {
          const key = `${ep.method}:${ep.path}`;
          const isOpen = open === key;
          const pathOnly = ep.path.split(' ')[0];
          const curl =
            ep.sample ||
            `curl -s -H "Authorization: Bearer $QEVA_TOKEN" \\\n  https://your-qeva.example${pathOnly}`;
          return (
            <li key={key} className={cn(i > 0 && 'border-t border-border')}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <MethodBadgeLight method={ep.method} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" translate="no">
                  {ep.path}
                </span>
                <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground md:block">{ep.desc}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out',
                    isOpen && 'rotate-180'
                  )}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <div className="space-y-3 border-t border-border bg-[linear-gradient(180deg,hsl(var(--muted)/0.55),hsl(var(--card)))] px-3.5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">{ep.desc}</p>
                    {ep.scope ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Terminal className="h-3 w-3" aria-hidden />
                        {ep.scope}
                      </span>
                    ) : null}
                  </div>
                  <CodeBlock code={curl} language="bash" title="Request" />
                </div>
              ) : null}
            </li>
          );
        })}
        {!filtered.length ? (
          <li className="px-3 py-10 text-center text-sm text-muted-foreground">No endpoints match that filter.</li>
        ) : null}
      </ul>
    </div>
  );
}
