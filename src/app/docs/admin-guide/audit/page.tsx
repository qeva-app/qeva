'use client';

import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { BulletList, DocHeader, DocSection, DocTable, InlineCode } from '@/components/docs/ui';

export default function AdminAuditPage() {
  return (
    <div>
      <DocHeader
        kicker="Admin guide"
        title="Audit logging"
        description="Track security-relevant actions across the system, including human and agent clients."
      />

      <div className="space-y-12">
        <DocSection id="what" title="What gets logged">
          <BulletList
            items={[
              'Logins, failed logins, and logouts',
              'Password create, update, delete, and reveal',
              'Shared-link create, revoke, and view',
              'Encryption setup, unlock, lock, disable, recover',
              'Team membership and role changes',
              'Settings, MFA, and profile changes',
              'API token creation and deletion (password API access includes clientKind)',
            ]}
          />
        </DocSection>

        <DocSection id="fields" title="Audit log fields">
          <DocTable
            headers={['Field', 'Description']}
            rows={[
              [<InlineCode key="a">action</InlineCode>, 'e.g. USER_LOGIN, PASSWORD_CREATED, SHARED_LINK_VIEWED'],
              [<InlineCode key="b">resource</InlineCode>, 'Category of target (password, auth, shared_link, …)'],
              [<InlineCode key="c">details</InlineCode>, 'JSON context (ids, titles, clientKind — never secrets)'],
              [<InlineCode key="d">userId</InlineCode>, 'Who performed the action (null for unknown failed logins)'],
              [<InlineCode key="e">ipAddress</InlineCode>, 'Request IP'],
              [<InlineCode key="f">userAgent</InlineCode>, 'Client user-agent when available'],
              [<InlineCode key="g">createdAt</InlineCode>, 'Event timestamp'],
            ]}
          />
        </DocSection>

        <DocSection id="where" title="Where to view">
          <BulletList
            items={[
              'Personal trail: Audit trail in the app sidebar (own events + CSV export)',
              'Organization export: Reports → audit export (Enterprise / org accounts)',
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-admin-audit" pageTitle="Audit Logging" />
      </div>
    </div>
  );
}
