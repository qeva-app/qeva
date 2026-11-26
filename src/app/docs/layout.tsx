'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Book,
  Bot,
  ChevronDown,
  ChevronRight,
  Code,
  HelpCircle,
  Menu,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import FeedbackButton from '@/components/FeedbackButton';
import { DocsPager } from '@/components/docs/DocsPager';
import { DocsSearch, DocsSearchTrigger } from '@/components/docs/DocsSearch';
import { DocsToc } from '@/components/docs/DocsToc';
import { docsNav, type DocsNavItem } from '@/lib/docs-nav';
import { cn } from '@/lib/utils';

const icons = {
  book: Book,
  bot: Bot,
  users: Users,
  settings: Settings,
  shield: Shield,
  code: Code,
  help: HelpCircle,
  sparkles: Sparkles,
} as const;

function SidebarItem({
  item,
  pathname,
  onNavigate,
}: {
  item: DocsNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const childActive = item.children?.some((c) => pathname === c.href) ?? false;
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon ? icons[item.icon] : Book;

  if (item.children) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            childActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
          )}
        >
          <Icon size={15} aria-hidden />
          <span className="flex-1 text-left">{item.title}</span>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        </button>
        {open ? (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  pathname === child.href
                    ? 'bg-sidebar-primary/20 font-medium text-white'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                )}
              >
                <span className="min-w-0 flex-1 truncate">{child.title}</span>
                {child.edition === 'enterprise' ? (
                  <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200/90 ring-1 ring-violet-400/30">
                    EE
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        pathname === item.href
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon size={15} aria-hidden />
      {item.title}
    </Link>
  );
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_80%_-10%,hsl(var(--primary)/0.08),transparent_55%),hsl(var(--background))]">
      <a href="#docs-main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center">
          {/* Align with sidebar width so the bar isn’t a blank strip */}
          <div className="hidden h-full w-64 shrink-0 items-center justify-center border-r border-border/60 bg-sidebar px-4 lg:flex">
            <Link
              href="/docs"
              className="flex flex-col items-center justify-center rounded-md leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <span className="font-display text-2xl font-bold tracking-tight text-white" aria-hidden>
                qeva<span className="text-emerald-400">.</span>
              </span>
              <span className="mt-1 text-xs font-medium tracking-wide text-sidebar-foreground/70">
                Docs
              </span>
              <span className="sr-only">Qeva Docs</span>
            </Link>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            >
              {sidebarOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            </button>
            <Link
              href="/docs"
              className="flex flex-col items-center justify-center rounded-md leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <span className="font-display text-xl font-bold tracking-tight text-foreground" aria-hidden>
                qeva<span className="text-emerald-500">.</span>
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">Docs</span>
              <span className="sr-only">Qeva Docs</span>
            </Link>

            <div className="min-w-0 flex-1">
              <DocsSearchTrigger onOpen={() => setSearchOpen(true)} />
            </div>

            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft size={14} aria-hidden />
              <span className="hidden sm:inline">Back to app</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside
          className={cn(
            'fixed top-14 z-40 flex h-[calc(100vh-3.5rem)] w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-transform lg:sticky lg:top-14 lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="space-y-0.5" aria-label="Documentation">
            {docsNav.map((item) => (
              <SidebarItem
                key={item.title}
                item={item}
                pathname={pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </nav>

          <div className="mt-auto pt-6">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
              <p className="text-xs font-medium text-sidebar-accent-foreground">Need a hand?</p>
              <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/70">
                Search with Ctrl+K / ⌘K, or leave feedback on any page. EE = Enterprise.
              </p>
            </div>
          </div>
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 gap-6 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          <main
            id="docs-main"
            className="min-w-0 max-w-[46rem] flex-1 motion-page rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7"
          >
            {children}
            <DocsPager />
          </main>
          <DocsToc />
        </div>
      </div>

      <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <FeedbackButton />
    </div>
  );
}
