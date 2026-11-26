'use client';

import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { DocHeader, DocSection, EditionBadge } from '@/components/docs/ui';

export default function ReleaseNotesPage() {
  return (
    <div>
      <DocHeader
        kicker="Changelog"
        title="Release notes"
        description="Shipped capabilities in the current line. Edition tags mark where a feature applies."
      />

      <div className="space-y-12">
        <DocSection id="v1" title="v1.0.0">
          <p className="mb-4 text-sm text-muted-foreground">Initial release</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              { t: 'Password vault with AES-256-GCM', e: 'community' as const },
              { t: 'USER_MASTER zero-knowledge mode', e: 'community' as const },
              { t: 'Access tokens, /api/v1, CLI, MCP', e: 'community' as const },
              { t: 'Browser extension autofill / save', e: 'community' as const },
              { t: 'Import, share links, emergency access', e: 'community' as const },
              { t: 'Security scanning + HIBP (server-held)', e: 'community' as const },
              { t: 'Self-host Docker (Community image)', e: 'community' as const },
              { t: 'Company accounts, teams, RBAC', e: 'enterprise' as const },
              { t: 'SSO (Azure AD, Google, Okta OIDC)', e: 'enterprise' as const },
              { t: 'SCIM, directory sync, SIEM, Slack/Teams alerts', e: 'enterprise' as const },
            ].map((row) => (
              <li
                key={row.t}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <EditionBadge edition={row.e} />
                <span>{row.t}</span>
              </li>
            ))}
          </ul>
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-release-notes" pageTitle="Release Notes" />
      </div>
    </div>
  );
}
