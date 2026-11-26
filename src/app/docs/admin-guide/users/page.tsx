'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  BulletList,
  Callout,
  DocHeader,
  DocSection,
  DocTable,
  EditionBadge,
  StepList,
} from '@/components/docs/ui';

export default function AdminUsersPage() {
  return (
    <div>
      <DocHeader
        kicker="Admin guide"
        title="User management"
        description={
          <>
            Manage users, roles, and access in your organization. <EditionBadge edition="enterprise" /> - company
            accounts only.
          </>
        }
      />

      <Callout variant="info" title="Edition">
        Community is individuals-only (no org user directory). Compare editions in{' '}
        <Link href="/docs/open-core">open-core</Link>.
      </Callout>

      <div className="mt-12 space-y-12">
        <DocSection id="lifecycle" title="User lifecycle">
          <StepList
            steps={[
              { title: 'Register', body: 'User registers with their email address.' },
              { title: 'Verify', body: 'OTP is sent for email verification.' },
              { title: 'Admin review', body: 'Admin sees the user on the Users page.' },
              { title: 'Assign roles', body: 'Grant permissions via roles.' },
              { title: 'Activate / deactivate', body: 'Toggle access without deleting the account.' },
            ]}
          />
        </DocSection>

        <DocSection id="roles" title="Default roles">
          <DocTable
            headers={['Role', 'Permissions']}
            rows={[
              ['ADMIN', 'Full system access including user/role management'],
              ['MANAGER', 'Team management, reports, security scans'],
              ['USER', 'Password CRUD, own profile, basic access'],
            ]}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Permission counts come from <Link href="/docs/rbac">RBAC seeding</Link> - not live user totals.
          </p>
        </DocSection>

        <DocSection id="actions" title="Admin actions">
          <BulletList
            items={[
              <><strong>Activate/Deactivate:</strong> Toggle access without deleting</>,
              <><strong>Reset Password:</strong> Send a reset to the user</>,
              <><strong>Assign Role:</strong> Change role from the user detail page</>,
              <><strong>View Sessions:</strong> Monitor active sessions</>,
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-admin-users" pageTitle="User Management" />
      </div>
    </div>
  );
}
