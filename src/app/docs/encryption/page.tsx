'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  BulletList,
  CodeBlock,
  DocHeader,
  DocSection,
  InlineCode,
  StepList,
} from '@/components/docs/ui';

export default function EncryptionDeepDivePage() {
  return (
    <div>
      <DocHeader
        kicker="Security model"
        title="Encryption deep dive"
        description="Technical details of AES-GCM formats, key hierarchy, and transport sealing."
        actions={
          <Link href="/docs/user-guide/encryption" className="btn btn-outline btn-sm">
            User how-to
          </Link>
        }
      />

      <div className="space-y-12">
        <DocSection id="aes" title="AES-256-GCM (v3)">
          <p className="mb-3">All new encryption uses AES-256-GCM:</p>
          <CodeBlock
            language="text"
            title="v3 payload"
            code={`JSON: { version, iv, authTag, encrypted } (hex fields)
Cipher: AES-256-GCM, IV: 12 bytes, Auth tag: 16 bytes
Master-key KEK: Argon2id (64 MiB, t=3, p=1) → 32-byte key`}
          />
        </DocSection>

        <DocSection id="hierarchy" title="Key hierarchy (USER_MASTER)">
          <ol className="space-y-3">
            {[
              {
                t: 'Master password',
                b: 'User-provided; unlock/setup/recover stay in the browser — not sent to the server.',
              },
              {
                t: 'KEK',
                b: 'Derived via Argon2id. Wraps/unwraps the DEK only.',
              },
              {
                t: 'DEK',
                b: 'Random 256-bit key. Encrypted with KEK and stored in the database.',
              },
              {
                t: 'Per-entry encryption',
                b: 'Each password encrypted with the DEK (AES-256-GCM, unique IV).',
              },
            ].map((s) => (
              <li key={s.t} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="font-medium text-foreground">{s.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.b}</p>
              </li>
            ))}
          </ol>
        </DocSection>

        <DocSection id="rsa" title="RSA-OAEP transport">
          <StepList
            steps={[
              {
                title: 'Fetch public key',
                body: (
                  <>
                    Client loads <InlineCode>/api/auth/public-key</InlineCode>.
                  </>
                ),
              },
              {
                title: 'Seal credentials',
                body: 'Browser seals with a one-time AES key, wraps that key with RSA-OAEP (SHA-256).',
              },
              {
                title: 'Send ciphertext only',
                body: 'Plaintext credentials are not accepted by the server.',
              },
              {
                title: 'Server unwrap',
                body: 'Private key unwraps the AES key and decrypts credentials (Node crypto).',
              },
            ]}
          />
        </DocSection>

        <DocSection id="session-dek" title="Session DEK">
          <BulletList
            items={[
              'DEK held in memory only while unlocked',
              'Cleared after 30 minutes of inactivity',
              'HTTP-only encrypted session cookie',
              'Manual lock clears the DEK immediately',
            ]}
          />
        </DocSection>

        <DocSection id="recovery" title="Recovery file">
          <p>
            Setup generates a recovery file with a backup of the encrypted DEK under a separate recovery key. Store it
            offline — it is the only way to reset a forgotten master password.
          </p>
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-encryption" pageTitle="Encryption Deep Dive" />
      </div>
    </div>
  );
}
