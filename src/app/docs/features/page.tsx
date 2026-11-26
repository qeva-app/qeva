'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { Callout, DocHeader, DocSection, EditionBadge, InlineCode } from '@/components/docs/ui';

const groups: {
  id: string;
  title: string;
  edition?: 'community' | 'enterprise';
  items: string[];
}[] = [
  {
    id: 'passwords',
    title: 'Password management',
    edition: 'community',
    items: [
      'Unlimited credentials with AES-256-GCM encryption',
      'Categories, services, and personal vault',
      'Version history and one-click copy',
      'Generator with presets and entropy scoring',
    ],
  },
  {
    id: 'security',
    title: 'Security',
    edition: 'community',
    items: [
      'Server-side or USER_MASTER encryption modes',
      'RSA-OAEP transmission and Argon2 master hashing',
      '7-point automated security scanning',
      'Session auto-lock and audit logging',
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations (Community)',
    edition: 'community',
    items: [
      'Access tokens + /api/v1 + CLI + MCP',
      'Browser extension autofill / save',
      'CSV/JSON import (browsers, Bitwarden, 1Password, LastPass)',
      'Share links and emergency access',
    ],
  },
  {
    id: 'teams',
    title: 'Team collaboration',
    edition: 'enterprise',
    items: ['OWNER, ADMIN, MEMBER, VIEWER roles', 'Secure password sharing within teams', 'Team-specific permissions'],
  },
  {
    id: 'admin',
    title: 'Organization administration',
    edition: 'enterprise',
    items: [
      'Company accounts and RBAC',
      'Domain-restricted registration',
      'SSO: Azure AD, Google, Okta OIDC',
      'SCIM, directory sync, SIEM, Slack/Teams alerts',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div>
      <DocHeader
        kicker="Product capabilities"
        title="Features"
        description={
          <>
            Vault, security, and agent access on <EditionBadge edition="community" />. Teams, SSO, and org admin on{' '}
            <EditionBadge edition="enterprise" />. See the <Link href="/docs/open-core">edition comparison</Link>.
          </>
        }
      />

      <div className="space-y-10">
        {groups.map((g) => (
          <DocSection key={g.id} id={g.id} title={g.title}>
            {g.edition ? (
              <div className="mb-3">
                <EditionBadge edition={g.edition} />
              </div>
            ) : null}
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.items.map((item) => (
                <li key={item} className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm shadow-sm">
                  {item}
                </li>
              ))}
            </ul>
          </DocSection>
        ))}

        <DocSection id="agents" title="AI agents">
          <div className="mb-3">
            <EditionBadge edition="community" />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm shadow-sm">
              Same vault ACL for humans and agents via access tokens
            </li>
            <li className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm shadow-sm">
              Client kinds <InlineCode>HUMAN</InlineCode> and <InlineCode>AGENT</InlineCode> for audit
            </li>
            <li className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm shadow-sm">
              Machine API for whoami, list, get, create, update, delete
            </li>
            <li className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm shadow-sm">
              Built-in CLI and MCP under <InlineCode>agents/</InlineCode>
            </li>
          </ul>
          <Callout variant="tip" title="Walkthrough">
            <Link href="/docs/developer/agents">Open the AI agents guide</Link>
          </Callout>
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-features" pageTitle="Features" />
      </div>
    </div>
  );
}
