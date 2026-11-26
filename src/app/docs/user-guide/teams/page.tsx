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

export default function TeamsGuidePage() {
  return (
    <div>
      <DocHeader
        kicker="User guide"
        title="Teams & collaboration"
        description={
          <>
            Share passwords securely within your organization. <EditionBadge edition="enterprise" /> only — Community
            is individuals-only.
          </>
        }
      />

      <Callout variant="info" title="Edition">
        Teams require a company account on Enterprise. Community users: see{' '}
        <Link href="/docs/open-core">open-core editions</Link> or <Link href="/docs/self-hosting">self-hosting</Link>.
      </Callout>

      <div className="mt-12 space-y-12">
        <DocSection id="create" title="Creating a team">
          <StepList
            steps={[
              { title: 'Open Teams', body: 'Navigate to Teams from the sidebar.' },
              { title: 'Create Team', body: 'Enter a name and optional description.' },
              { title: 'Ownership', body: 'You are assigned OWNER automatically.' },
            ]}
          />
        </DocSection>

        <DocSection id="roles" title="Team roles">
          <DocTable
            headers={['Role', 'Capabilities']}
            rows={[
              ['OWNER', 'Full control, manage members, delete team'],
              ['ADMIN', 'Manage members and passwords'],
              ['MEMBER', 'View and add passwords'],
              ['VIEWER', 'View passwords only'],
            ]}
          />
        </DocSection>

        <DocSection id="share" title="Sharing passwords">
          <StepList
            steps={[
              { title: 'Open the team', body: 'From the Teams page.' },
              { title: 'Add Password', body: 'Add within the team context.' },
              { title: 'Access', body: 'Members see it according to their team role.' },
            ]}
          />
        </DocSection>

        <DocSection id="members" title="Managing members">
          <BulletList
            items={[
              <>Only <strong>OWNER</strong> and <strong>ADMIN</strong> can add or remove members</>,
              'Members are added by email',
              'Role can be changed after adding',
              'Removing a member revokes access to all team passwords',
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-user-teams" pageTitle="Teams & Collaboration" />
      </div>
    </div>
  );
}
