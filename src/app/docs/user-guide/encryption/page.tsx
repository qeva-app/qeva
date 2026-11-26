'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  BulletList,
  Callout,
  DocHeader,
  DocSection,
  StepList,
} from '@/components/docs/ui';

export default function EncryptionGuidePage() {
  return (
    <div>
      <DocHeader
        kicker="User guide"
        title="Encryption"
        description="Choose a mode, set up a master key, unlock the vault, and recover safely."
        actions={
          <Link href="/docs/encryption" className="btn btn-outline btn-sm">
            Technical deep dive
          </Link>
        }
      />

      <div className="space-y-12">
        <DocSection id="modes" title="Encryption modes">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="font-medium text-foreground">PUBLIC_KEY (default)</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Server-side AES-256-GCM with a shared encryption key. Simpler; the server holds the key.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="font-medium text-foreground">USER_MASTER</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Per-user master password. Unlock and personal crypto stay in the browser — the master password is not
                sent to the server.
              </p>
            </div>
          </div>
        </DocSection>

        <DocSection id="setup" title="Setting up master-key encryption">
          <StepList
            steps={[
              { title: 'Settings', body: 'Open Settings → Encryption.' },
              { title: 'Set Up Encryption', body: 'Choose a strong master password (admins cannot recover it).' },
              { title: 'Recovery file', body: 'Download it and store it securely offline.' },
              { title: 'Confirm', body: 'Confirm the master password to finish.' },
            ]}
          />
          <Callout variant="warn" title="Irrecoverable without both">
            If you lose your master password and the recovery file, encrypted data cannot be recovered.
          </Callout>
        </DocSection>

        <DocSection id="unlock" title="Unlocking the vault">
          <BulletList
            items={[
              'You are prompted for the master password after login',
              'Auto-locks after 30 minutes of inactivity',
              'Manual lock from Settings clears the in-memory key',
            ]}
          />
        </DocSection>

        <DocSection id="recovery" title="Recovery">
          <StepList
            steps={[
              { title: 'Open Encryption Recovery', body: 'From Settings or the recovery route.' },
              { title: 'Upload recovery file', body: 'The file downloaded during setup.' },
              { title: 'Set a new master password', body: 'Follow the prompts to finish.' },
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-user-encryption" pageTitle="Encryption Guide" />
      </div>
    </div>
  );
}
