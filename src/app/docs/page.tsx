'use client';

import Link from 'next/link';
import { Bot, ChevronRight, Code2, Container, Shield } from 'lucide-react';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { Callout, DocHeader, EditionBadge, InlineCode } from '@/components/docs/ui';

const guides = [
  {
    href: '/docs/self-hosting',
    title: 'Self-host Community',
    detail: 'Docker Compose, secrets, health check, bootstrap admin.',
    icon: Container,
    tone: 'bg-sky-500/10 text-sky-700',
    badge: 'community' as const,
  },
  {
    href: '/docs/developer/agents',
    title: 'Connect an AI agent',
    detail: 'Token, CLI, or MCP - same vault ACL as a human.',
    icon: Bot,
    tone: 'bg-emerald-500/10 text-emerald-700',
  },
  {
    href: '/docs/user-guide/passwords',
    title: 'Manage passwords',
    detail: 'Store, organize, import, and generate credentials.',
    icon: Shield,
    tone: 'bg-amber-500/10 text-amber-800',
  },
  {
    href: '/docs/developer/api',
    title: 'Call the API',
    detail: 'Session auth, Bearer tokens, and /api/v1.',
    icon: Code2,
    tone: 'bg-violet-500/10 text-violet-700',
  },
];

const facts = [
  { label: 'AES-256-GCM', detail: 'Credentials encrypted at rest' },
  { label: 'Equal clients', detail: 'Humans & agents, one ACL' },
  { label: 'Open-core', detail: 'Community + Enterprise editions' },
  { label: 'Audit trail', detail: 'clientKind on secret access' },
];

export default function DocsOverview() {
  return (
    <div>
      <DocHeader
        kicker="Qeva documentation"
        title="Everything you need to run the vault"
        description="Guides for people, operators, and AI agents - built around the same encrypted credential store. Community is individuals-only; org features need Enterprise."
        actions={
          <>
            <Link href="/docs/self-hosting" className="btn btn-primary btn-sm">
              Self-host guide
            </Link>
            <Link href="/docs/security" className="btn btn-outline btn-sm">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              Security model
            </Link>
          </>
        }
        aside={
          <div className="grid grid-cols-2 gap-2">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-xs font-semibold text-primary">{f.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{f.detail}</p>
              </div>
            ))}
          </div>
        }
      />

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">Start here</h2>
          <p className="text-xs text-muted-foreground">Pick a path</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {guides.map((g) => {
            const Icon = g.icon;
            return (
              <Link
                key={g.href}
                href={g.href}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${g.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    {g.title}
                    {g.badge ? (
                      <span className="ml-1">
                        <EditionBadge edition={g.badge} />
                      </span>
                    ) : null}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{g.detail}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <Callout variant="tip" title="Agents are equal vault clients">
        Tokens are labeled <InlineCode>HUMAN</InlineCode> or <InlineCode>AGENT</InlineCode> for audit only.
        Scopes and ACL stay the same. Jump to the{' '}
        <Link href="/docs/developer/agents">AI agents guide</Link>. Org admin, teams, and SSO are{' '}
        <Link href="/docs/open-core">Enterprise</Link>.
      </Callout>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-overview" pageTitle="Documentation Overview" />
      </div>
    </div>
  );
}
