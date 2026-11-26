'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { BulletList, DocHeader, DocSection } from '@/components/docs/ui';

export default function AdminSettingsPage() {
  return (
    <div>
      <DocHeader
        kicker="Admin guide"
        title="System settings"
        description="Configure application-wide settings, email, and tokens."
      />

      <div className="space-y-12">
        <DocSection id="general" title="General">
          <BulletList
            items={[
              <><strong>Application Name:</strong> Shown in the header and emails</>,
              <><strong>Session Timeout:</strong> Auto-logout after inactivity (default 30 minutes)</>,
              <><strong>Password Policy:</strong> Minimum length and complexity</>,
            ]}
          />
        </DocSection>

        <DocSection id="email" title="Email">
          <p className="mb-3">Qeva uses SMTP for outbound mail:</p>
          <BulletList
            items={[
              'OTP verification during registration',
              'Password reset emails',
              'Weekly summary emails (Monday 10 AM IST)',
            ]}
          />
          <p className="mt-3 text-sm">
            Configure SMTP via environment variables. Test delivery from the admin panel.
          </p>
        </DocSection>

        <DocSection id="weekly" title="Weekly email summary">
          <BulletList
            items={[
              'Sent every Monday at 10 AM IST',
              'Includes login count, passwords added/updated, security score',
              'Engagement badges based on activity',
              'Test emails can be triggered from the admin weekly summary page',
            ]}
          />
        </DocSection>

        <DocSection id="tokens" title="Access tokens">
          <p>
            Generate API tokens from Settings for integrations. Each token has expiry and optional IP allowlists. See{' '}
            <Link href="/docs/developer/access-tokens">Access Tokens</Link> for agent/CLI use.
          </p>
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-admin-settings" pageTitle="System Settings" />
      </div>
    </div>
  );
}
