'use client';

import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { BulletList, DocHeader, DocSection, StepList } from '@/components/docs/ui';

export default function PasswordsGuidePage() {
  return (
    <div>
      <DocHeader
        kicker="User guide"
        title="Managing passwords"
        description="Store, organize, generate, and import credentials in your vault."
      />

      <div className="space-y-12">
        <DocSection id="add" title="Adding a password">
          <StepList
            steps={[
              { title: 'Open the vault', body: 'Navigate to Password Vault from the sidebar.' },
              { title: 'Add Password', body: 'Click Add Password and fill in service name, username, and password.' },
              {
                title: 'Optional fields',
                body: 'Select a category, add a URL, and write notes. Choose Personal visibility (only you).',
              },
              { title: 'Save', body: 'Click Save to encrypt and store the credential.' },
            ]}
          />
        </DocSection>

        <DocSection id="generator" title="Password generator">
          <BulletList
            items={[
              <><strong>Presets:</strong> Strong (16 chars), Maximum (32 chars), PIN (6 digits), Passphrase</>,
              <><strong>Options:</strong> Length, uppercase, lowercase, numbers, symbols</>,
              <><strong>Exclusions:</strong> Similar characters (0/O, 1/l), ambiguous symbols</>,
              <><strong>Entropy:</strong> Real-time bits of entropy</>,
            ]}
          />
        </DocSection>

        <DocSection id="organize" title="Organizing">
          <BulletList
            items={[
              'Use categories to group related passwords',
              'Search across name, username, URL, and notes',
              'Switch between grid and list views',
              'Filter by Personal (Community) or Teams tabs when Enterprise is enabled',
            ]}
          />
        </DocSection>

        <DocSection id="history" title="Password history">
          <p>
            Every update keeps the previous version. Open history from the edit modal to review or restore an older
            password.
          </p>
        </DocSection>

        <DocSection id="import" title="Importing">
          <StepList
            steps={[
              { title: 'Open Import', body: 'Go to Import Passwords from the sidebar.' },
              {
                title: 'Pick a source',
                body: 'Chrome, Firefox, Safari, 1Password, Bitwarden, or LastPass (CSV/JSON).',
              },
              { title: 'Upload & confirm', body: 'Review parsed entries, then confirm import.' },
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-user-passwords" pageTitle="Managing Passwords" />
      </div>
    </div>
  );
}
