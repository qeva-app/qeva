'use client';

import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { BulletList, CodeBlock, DocHeader, DocSection, InlineCode } from '@/components/docs/ui';

const components = [
  { name: 'PasswordList', desc: 'Password grid with copy, edit, delete, strength indicator' },
  { name: 'PasswordStrengthIndicator', desc: 'Visual strength bar with color-coded score' },
  { name: 'AddPasswordModal', desc: 'Full form with templates, auto-generate, encryption awareness' },
  { name: 'EditPasswordModal', desc: 'Edit existing password with version history' },
  { name: 'MasterPasswordPrompt', desc: 'Modal for master password entry to unlock vault' },
  { name: 'SessionTimeoutWarning', desc: 'Warning modal before session expires' },
  { name: 'DocFeedbackWidget', desc: 'In-docs feedback widget at page bottom' },
  { name: 'FeedbackButton', desc: 'Floating feedback button (docs)' },
  { name: 'Sidebar', desc: 'Collapsible navigation sidebar' },
  { name: 'Header', desc: 'Top bar with breadcrumbs, search, notifications' },
];

export default function ComponentsDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="Developer"
        title="Component reference"
        description="Reusable React components under src/components/. Aimed at contributors maintaining the app UI."
      />

      <div className="space-y-12">
        <DocSection id="list" title="Component list">
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c.name} className="rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm">
                <p className="font-mono text-sm font-semibold text-foreground">{c.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="usage" title="Usage">
          <p className="mb-3">
            Import with the <InlineCode>@/</InlineCode> alias:
          </p>
          <CodeBlock
            language="tsx"
            code={`import { LoadingSpinner } from '@/components/LoadingSpinner';
import PasswordList from '@/components/PasswordList';`}
          />
        </DocSection>

        <DocSection id="styling" title="Styling">
          <BulletList
            items={[
              <>Tailwind CSS plus utilities in <InlineCode>globals.css</InlineCode> (<InlineCode>.btn</InlineCode>, <InlineCode>.card</InlineCode>, …)</>,
              'Motion via Framer Motion for modals/transitions',
              'Icons from Lucide React',
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-developer-components" pageTitle="Component Reference" />
      </div>
    </div>
  );
}
