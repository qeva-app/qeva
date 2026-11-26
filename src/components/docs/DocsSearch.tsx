'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { flattenDocsNav } from '@/lib/docs-nav';
import { EditionBadge } from '@/components/docs/ui';

function useModKeyLabel() {
  const [label, setLabel] = useState('Ctrl');
  useEffect(() => {
    const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac');
    setLabel(mac ? '⌘' : 'Ctrl');
  }, []);
  return label;
}

export function DocsSearchTrigger({ onOpen }: { onOpen: () => void }) {
  const mod = useModKeyLabel();
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center justify-center rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        aria-label="Search docs"
      >
        <Search className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="hidden h-9 w-full max-w-md items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Search docs…</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {mod}K
        </kbd>
      </button>
    </>
  );
}

export function DocsSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const pages = flattenDocsNav();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  const groups = Array.from(new Set(pages.map((p) => p.group)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search docs…" />
      <CommandList>
        <CommandEmpty>No matching pages.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {pages
              .filter((p) => p.group === group)
              .map((p) => (
                <CommandItem
                  key={p.href}
                  value={`${p.group} ${p.title} ${p.keywords.join(' ')} ${p.href} ${p.edition ?? ''}`}
                  onSelect={() => go(p.href)}
                >
                  <span>{p.title}</span>
                  {p.edition === 'enterprise' ? (
                    <span className="ml-2">
                      <EditionBadge edition="enterprise" />
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">{p.group}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
