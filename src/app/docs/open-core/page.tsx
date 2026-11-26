'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  Callout,
  CodeBlock,
  DocHeader,
  DocSection,
  DocTable,
  EditionBadge,
  InlineCode,
} from '@/components/docs/ui';

export default function OpenCoreDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="Editions"
        title="Open-core editions"
        description="One codebase. Two editions. Community is the public Docker image (individuals). Enterprise adds company accounts and org integrations."
        actions={
          <Link href="/docs/self-hosting" className="btn btn-primary btn-sm">
            Self-host Community
          </Link>
        }
      />

      <div className="space-y-12">
        <DocSection id="compare" title="What each edition includes">
          <DocTable
            headers={['Capability', 'Community', 'Enterprise']}
            rows={[
              ['Individual vault + MFA', 'Yes', 'Yes'],
              ['Company / organization accounts', 'No', 'Yes'],
              ['Teams, RBAC, org workflows', 'No', 'Yes'],
              ['Access tokens, /api/v1, CLI/MCP, extension', 'Yes', 'Yes'],
              ['Import, share links, emergency access', 'Yes', 'Yes'],
              ['Security scan / HIBP', 'Personal vault', 'Yes (org too)'],
              ['SSO (Azure AD / Google / Okta)', 'No', 'Yes'],
              ['SCIM + directory sync', 'No', 'Yes'],
              ['SIEM export + Slack/Teams alerts', 'No', 'Yes'],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <EditionBadge edition="community" />
            <span className="text-sm text-muted-foreground">= public image default</span>
            <EditionBadge edition="enterprise" />
            <span className="text-sm text-muted-foreground">= private overlay / managed</span>
          </div>
        </DocSection>

        <DocSection id="how" title="How edition is chosen">
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground">
            <li>
              <InlineCode>QEVA_EDITION=community|enterprise</InlineCode> (env wins when set).
            </li>
            <li>
              Else: if <InlineCode>@qeva/enterprise</InlineCode> resolves → enterprise.
            </li>
            <li>Else → community.</li>
          </ol>
          <Callout variant="info" title="Public Docker">
            The Compose image defaults to <InlineCode>community</InlineCode> (individuals only).
          </Callout>
        </DocSection>

        <DocSection id="repos" title="What’s public">
          <DocTable
            headers={['Edition', 'Visibility', 'Role']}
            rows={[
              [
                <InlineCode key="q">Community</InlineCode>,
                'Public (this repo)',
                'Individual vault + Docker image; EE paths are stubs',
              ],
              [
                <InlineCode key="e">Enterprise</InlineCode>,
                'Private / managed',
                'Company accounts and org integrations — not in this repository',
              ],
            ]}
          />
          <Callout variant="info" title="No public Enterprise source">
            Enterprise code is not published on GitHub. Contact Qeva for Enterprise or managed hosting.
          </Callout>
        </DocSection>

        <DocSection id="check" title="Verify Community build">
          <CodeBlock
            language="bash"
            code={`QEVA_EDITION=community node scripts/selfcheck-edition.js
npm run selfcheck`}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-open-core" pageTitle="Open-core editions" />
      </div>
    </div>
  );
}
