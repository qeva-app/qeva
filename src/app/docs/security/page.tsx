'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  BulletList,
  CodeBlock,
  DocHeader,
  DocSection,
  InlineCode,
} from '@/components/docs/ui';

export default function SecurityDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="Security model"
        title="Security"
        description="How Qeva protects data at rest, in transit, and at the application boundary."
        actions={
          <Link href="/docs/encryption" className="btn btn-outline btn-sm">
            Encryption deep dive
          </Link>
        }
      />

      <div className="space-y-12">
        <DocSection id="at-rest" title="Encryption at rest">
          <BulletList
            items={[
              <>Passwords use <strong>AES-256-GCM</strong> (v3, 12-byte IV)</>,
              <>Master-key KEK derived with <strong>Argon2id</strong></>,
              'Unique IV per operation; auth tags prevent tampering',
              'USER_MASTER: unlock + personal crypto in the browser; server stores ciphertext only',
              'Team/org shared secrets use per-organization keys (Enterprise)',
              'Optional TOTP on sign-in',
            ]}
          />
        </DocSection>

        <DocSection id="in-transit" title="Encryption in transit">
          <BulletList
            items={[
              'HTTPS enforced in production with HSTS',
              <>Login credentials sealed client-side with <strong>RSA-OAEP</strong> before send</>,
              'Reverse-proxy TLS is the recommended production path',
            ]}
          />
        </DocSection>

        <DocSection id="auth" title="Authentication">
          <BulletList
            items={[
              <>Account passwords hashed with <strong>bcrypt</strong> (12 rounds)</>,
              <>Master passwords hashed with <strong>Argon2</strong></>,
              'JWT sessions with 30-minute max age',
              'Email OTP for registration',
              'Auto-logout on inactivity',
            ]}
          />
        </DocSection>

        <DocSection id="headers" title="Security headers">
          <CodeBlock
            language="http"
            title="response headers"
            code={`X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: origin-when-cross-origin
Content-Security-Policy: default-src 'self'; …
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`}
          />
        </DocSection>

        <DocSection id="scan" title="Security scanning">
          <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-7 text-muted-foreground">
            <li>Weak passwords (low strength score)</li>
            <li>Reused passwords across services</li>
            <li>Common / dictionary passwords</li>
            <li>Expired passwords exceeding age policy</li>
            <li>Sequential character patterns</li>
            <li>Recovery configuration status</li>
            <li>
              Have I Been Pwned via k-anonymity (server-held secrets only; <InlineCode>USER_MASTER</InlineCode> entries
              are not scanned server-side)
            </li>
          </ol>
        </DocSection>

        <DocSection id="validation" title="Input validation">
          <BulletList
            items={[
              'Null byte stripping and control-character removal',
              'Maximum length enforcement',
              'Community image is individuals-only; company signup is Enterprise',
              'Zod schema validation on API inputs',
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-security" pageTitle="Security" />
      </div>
    </div>
  );
}
