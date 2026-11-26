'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { docsNeighbors } from '@/lib/docs-nav';

export function DocsPager() {
  const pathname = usePathname();
  const { prev, next } = docsNeighbors(pathname);

  if (!prev && !next) return null;

  return (
    <nav className="mt-10 grid gap-3 border-t border-border pt-6 sm:grid-cols-2" aria-label="Page">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-xs text-muted-foreground">Previous</span>
            <span className="text-sm font-medium text-foreground">
              {prev.group !== prev.title ? `${prev.group}: ${prev.title}` : prev.title}
            </span>
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex items-start justify-end gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3.5 text-right transition-colors hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            <span className="block text-xs text-muted-foreground">Next</span>
            <span className="text-sm font-medium text-foreground">
              {next.group !== next.title ? `${next.group}: ${next.title}` : next.title}
            </span>
          </span>
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
