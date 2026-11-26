'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  BulletList,
  Callout,
  CodeBlock,
  DocHeader,
  DocSection,
  EditionBadge,
  InlineCode,
} from '@/components/docs/ui';

const perms = [
  'passwords:create',
  'passwords:read',
  'passwords:update',
  'passwords:delete',
  'teams:create',
  'teams:manage',
  'users:read',
  'users:manage',
  'roles:manage',
  'settings:manage',
  'backup:manage',
  'reports:view',
  'reports:manage',
  'security:scan',
  'audit:view',
];

export default function RBACDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="Security model"
        title="Role-based access control"
        description={
          <>
            Database-backed roles and permissions. Full org RBAC is <EditionBadge edition="enterprise" />.
          </>
        }
      />

      <Callout variant="info" title="Edition">
        Community individuals still use vault ACL for tokens. Company roles/teams need Enterprise —{' '}
        <Link href="/docs/open-core">compare editions</Link>.
      </Callout>

      <div className="mt-12 space-y-12">
        <DocSection id="architecture" title="Architecture">
          <BulletList
            items={[
              <><strong>Roles:</strong> Named permission sets (ADMIN, MANAGER, USER)</>,
              <>
                <strong>Permissions:</strong> Capabilities like <InlineCode>passwords:create</InlineCode>
              </>,
              <><strong>UserRoleAssignment:</strong> Links users to roles</>,
              <><strong>UserPermission:</strong> Direct overrides</>,
            ]}
          />
        </DocSection>

        <DocSection id="format" title="Permission format">
          <p className="mb-3">
            Pattern: <InlineCode>resource:action</InlineCode>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {perms.map((p) => (
              <div key={p} className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs">
                {p}
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="checking" title="Permission checking">
          <BulletList
            items={[
              <>Cached for <strong>15 minutes</strong></>,
              <>
                Refresh via <InlineCode>/api/user/refresh-permissions</InlineCode>
              </>,
              <>
                API routes use <InlineCode>withAuth</InlineCode>
              </>,
              <>
                Client checks use <InlineCode>permissions-client.ts</InlineCode> (no DB)
              </>,
            ]}
          />
        </DocSection>

        <DocSection id="sync" title="Role sync & seeding">
          <p className="mb-3">
            <InlineCode>role-sync.ts</InlineCode> keeps legacy <InlineCode>User.role</InlineCode> aligned with{' '}
            <InlineCode>UserRoleAssignment</InlineCode>.
          </p>
          <CodeBlock
            language="bash"
            code={`npm run sync:roles
npm run seed:roles`}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Seeding creates system roles ADMIN, MANAGER, and USER with the default permission sets.
          </p>
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-rbac" pageTitle="Role-Based Access Control" />
      </div>
    </div>
  );
}
