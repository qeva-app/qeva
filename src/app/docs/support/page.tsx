'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { BulletList, Callout, DocHeader, DocSection } from '@/components/docs/ui';

const issues = [
  {
    title: "Can't log in",
    items: [
      'Verify email (check for OTP)',
      'Use the email registered to the account',
      'Try password reset on the login page',
      'Ask an admin if the account was deactivated (Enterprise)',
    ],
  },
  {
    title: 'Vault is locked',
    items: [
      'Enter your master password to unlock',
      'If forgotten, use the recovery file',
      'Vault auto-locks after 30 minutes of inactivity',
    ],
  },
  {
    title: 'Session expired',
    items: [
      'Sessions expire after 30 minutes of inactivity',
      'A warning appears 5 minutes before expiry',
      'Log in again to continue',
    ],
  },
  {
    title: 'Permission denied',
    items: [
      'Your role may lack the required permission (Enterprise RBAC)',
      'Ask an admin to adjust roles',
      'Refresh permissions from Settings',
    ],
  },
  {
    title: 'Self-host health check fails',
    items: [
      'Confirm docker compose ps and postgres logs',
      'Check NEXTAUTH_URL, secrets, and DATABASE_URL shape',
      'See the Self-hosting troubleshooting table',
    ],
  },
];

export default function SupportPage() {
  return (
    <div>
      <DocHeader
        kicker="Help"
        title="Support"
        description="Common issues and where to get help."
      />

      <div className="space-y-12">
        <DocSection id="issues" title="Common issues">
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.title} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="font-medium text-foreground">{issue.title}</h3>
                <div className="mt-2">
                  <BulletList items={issue.items} />
                </div>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="help" title="Getting help">
          <BulletList
            items={[
              <>
                Self-host deploy problems: <Link href="/docs/self-hosting#troubleshooting">Self-hosting → Troubleshooting</Link>
              </>,
              <>
                Leave feedback via the floating button or <Link href="/docs/feedback">Feedback</Link>
              </>,
              'Contact your administrator for account issues on Enterprise',
            ]}
          />
          <Callout variant="tip" title="Health check">
            <code className="font-mono text-xs">curl -s http://localhost:3100/api/health</code>
          </Callout>
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-support" pageTitle="Support" />
      </div>
    </div>
  );
}
