'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  Callout,
  CodeBlock,
  DocHeader,
  DocSection,
  DocTabs,
  InlineCode,
  InteractiveChecklist,
  StepList,
} from '@/components/docs/ui';

export default function AccessTokensDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="Credentials, scopes, and audit"
        title="Access Tokens"
        description="Issue tokens for programmatic API access. Human clients and AI agents share the same vault ACL."
        actions={
          <Link href="/docs/developer/agents" className="btn btn-primary btn-sm">
            Agent setup
          </Link>
        }
      />

      <div className="space-y-12">
        <DocSection id="create" title="Create a token">
          <StepList
            steps={[
              { title: 'Open Settings', body: 'Use the sidebar Settings entry.' },
              { title: 'Access Tokens', body: 'Scroll to the Access Tokens section.' },
              {
                title: 'Generate',
                body: (
                  <>
                    Create a token — choose <strong>AI agent</strong> for agent clients.
                  </>
                ),
              },
              {
                title: 'Copy once',
                body: 'Set name, optional expiry / IP whitelist, then store the value securely.',
              },
            ]}
          />
          <Callout variant="warn" title="Shown once">
            Never commit the token. Prefer a secret manager.
          </Callout>
        </DocSection>

        <DocSection id="use" title="Use a token">
          <DocTabs
            tabs={[
              {
                value: 'curl',
                label: 'curl',
                content: (
                  <CodeBlock
                    language="bash"
                    title="Terminal"
                    code={`curl -H "Authorization: Bearer qeva_xxxxxxxxxxxx" \\\n  https://your-qeva-instance/api/v1/me`}
                  />
                ),
              },
              {
                value: 'header',
                label: 'Header',
                content: <CodeBlock language="http" title="Header" code="Authorization: Bearer qeva_xxxxxxxxxxxx" />,
              },
              {
                value: 'env',
                label: 'Env',
                content: (
                  <CodeBlock
                    language="bash"
                    title="Shell"
                    code={`export QEVA_BASE_URL=https://your-qeva.example
export QEVA_TOKEN=qeva_xxxxxxxxxxxx`}
                  />
                ),
              },
            ]}
          />
        </DocSection>

        <DocSection id="validation" title="Validation and revocation">
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              'Validated on every request',
              'Expired tokens are rejected',
              'IP whitelist enforced when set',
              <>
                Audit trail includes <InlineCode>clientKind</InlineCode>
              </>,
              'Revoke in Settings — immediate',
            ].map((item, i) => (
              <li key={i} className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm shadow-sm">
                {item}
              </li>
            ))}
          </ul>
        </DocSection>

        <DocSection id="checklist" title="Hardening checklist">
          <InteractiveChecklist
            storageKey="qeva-docs-token-hardening"
            items={[
              { id: 'name', label: 'Name tokens by purpose (for example, cursor-mcp-prod)' },
              { id: 'expiry', label: 'Set an expiry for long-lived agent tokens' },
              { id: 'scope', label: 'Prefer passwords:read unless write is required' },
              { id: 'rotate', label: 'Rotate after team member or agent offboarding' },
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-developer-access-tokens" pageTitle="Access Tokens" />
      </div>
    </div>
  );
}
