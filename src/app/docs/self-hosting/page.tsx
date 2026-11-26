'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import {
  BulletList,
  Callout,
  CodeBlock,
  DocHeader,
  DocSection,
  DocTable,
  EditionBadge,
  InlineCode,
  InteractiveChecklist,
} from '@/components/docs/ui';

export default function SelfHostingDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="Deploy"
        title="Self-host with Docker"
        description={
          <>
            Run Qeva Community on your own infrastructure. Vault data stays in your PostgreSQL volume
            (or external Postgres/Supabase). <EditionBadge edition="community" /> is individuals only —
            no company signup, teams, or SSO.
          </>
        }
        actions={
          <Link href="/docs/open-core" className="btn btn-outline btn-sm">
            Compare editions
          </Link>
        }
      />

      <div className="space-y-12">
        <DocSection id="requirements" title="Requirements">
          <BulletList
            items={[
              <>Docker Engine 24+ and Docker Compose v2.20+ (<InlineCode>depends_on.required</InlineCode>)</>,
              '~1 GB RAM free (Postgres Alpine is light)',
              'Open outbound HTTPS if you use HIBP or SMTP',
            ]}
          />
        </DocSection>

        <DocSection id="quick-start" title="Quick start (bundled Postgres)">
          <CodeBlock
            language="bash"
            title="bundled"
            code={`cp .env.example .env
# Set NEXTAUTH_SECRET, ENCRYPTION_KEY, DB_PASSWORD, SUPER_ADMIN_EMAIL
docker compose --profile bundled up -d --build
docker compose ps
curl -s http://localhost:3100/api/health`}
          />
          <p className="mt-4">
            One-shot admin password (first boot only):
          </p>
          <CodeBlock
            language="bash"
            title="bootstrap password"
            code="docker compose logs qeva | grep QEVA_BOOTSTRAP_PASSWORD"
          />
          <p className="mt-4">
            Open <InlineCode>NEXTAUTH_URL</InlineCode> (default <InlineCode>http://localhost:3100</InlineCode>) and
            sign in with <InlineCode>SUPER_ADMIN_EMAIL</InlineCode> + that password.
          </p>
          <div className="mt-6">
            <InteractiveChecklist
              storageKey="docs-selfhost-checklist"
              items={[
                { id: 'env', label: 'Copy .env.example and set secrets' },
                { id: 'up', label: 'docker compose --profile bundled up -d --build' },
                { id: 'health', label: 'Confirm /api/health returns OK' },
                { id: 'admin', label: 'Grab bootstrap password from logs and sign in' },
              ]}
            />
          </div>
        </DocSection>

        <DocSection id="external-db" title="External Postgres / Supabase">
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground">
            <li>
              Set <InlineCode>QEVA_DATABASE_URL</InlineCode> in <InlineCode>.env</InlineCode> (
              <InlineCode>postgresql://</InlineCode> or <InlineCode>postgres://</InlineCode>). Do not put a
              localhost <InlineCode>DATABASE_URL</InlineCode> in the shell — Compose will pick it up and break
              the container.
            </li>
            <li>
              Set <InlineCode>SUPER_ADMIN_EMAIL</InlineCode> and secrets. <InlineCode>DB_PASSWORD</InlineCode> is
              unused without the bundled profile.
            </li>
            <li>
              Start without the bundled profile:
              <CodeBlock className="mt-3" language="bash" code="docker compose up -d --build" />
            </li>
          </ol>
          <Callout variant="tip" title="Supabase">
            Prefer the direct connection for migrations / <InlineCode>db push</InlineCode>, or the pooler URL with{' '}
            <InlineCode>?pgbouncer=true</InlineCode> for the app if you manage schema separately.
          </Callout>
        </DocSection>

        <DocSection id="environment" title="Environment">
          <DocTable
            headers={['Variable', 'Required', 'Purpose']}
            rows={[
              [<InlineCode key="a">NEXTAUTH_URL</InlineCode>, 'yes', 'Public base URL of this instance'],
              [<InlineCode key="b">NEXTAUTH_SECRET</InlineCode>, 'yes', 'Session signing'],
              [<InlineCode key="c">ENCRYPTION_KEY</InlineCode>, 'yes', 'Server-held vault encryption'],
              [<InlineCode key="d">SUPER_ADMIN_EMAIL</InlineCode>, 'yes (CE bootstrap)', 'Platform super-admin + first admin seed'],
              [<InlineCode key="e">DB_PASSWORD</InlineCode>, 'bundled only', 'Postgres password for the sidecar'],
              [<InlineCode key="f">QEVA_DATABASE_URL</InlineCode>, 'external only', 'Postgres/Supabase URL'],
              [<InlineCode key="g">QEVA_EDITION</InlineCode>, 'no', 'Defaults to community; enterprise unlocks company accounts'],
              [<InlineCode key="h">BOOTSTRAP_ADMIN_PASSWORD</InlineCode>, 'no', 'Skip auto-generate; set your own (≥10 chars)'],
            ]}
          />
        </DocSection>

        <DocSection id="extension" title="Browser extension">
          <p>
            Point the extension at your API base (<InlineCode>NEXTAUTH_URL</InlineCode>). Create an access token under
            Settings → Access Tokens. Packaged extension lives in <InlineCode>extension/</InlineCode>.
          </p>
        </DocSection>

        <DocSection id="tls" title="TLS / production">
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground">
            <li>Put a reverse proxy (Caddy, nginx, Traefik) in front with a real certificate.</li>
            <li>
              Set <InlineCode>NEXTAUTH_URL=https://vault.example.com</InlineCode>.
            </li>
            <li>
              Optionally set <InlineCode>FORCE_HTTPS=true</InlineCode> so bare HTTP redirects.
            </li>
          </ol>
          <Callout variant="warn" title="Postgres port">
            Postgres is not published to the host by default. Keep it that way in production.
          </Callout>
        </DocSection>

        <DocSection id="upgrades" title="Upgrades & backup">
          <CodeBlock
            language="bash"
            code={`git pull
docker compose --profile bundled up -d --build`}
          />
          <p className="mt-4">
            On start the container runs <InlineCode>prisma db push</InlineCode>. Back up the{' '}
            <InlineCode>postgres-data</InlineCode> volume (or your external DB) before upgrades. App logs live in{' '}
            <InlineCode>qeva-logs</InlineCode>.
          </p>
        </DocSection>

        <DocSection id="troubleshooting" title="Troubleshooting">
          <DocTable
            headers={['Symptom', 'Check']}
            rows={[
              [
                <>503 on <InlineCode>/api/health</InlineCode></>,
                <>
                  <InlineCode>docker compose logs postgres</InlineCode> — still starting / bad{' '}
                  <InlineCode>DB_PASSWORD</InlineCode>
                </>,
              ],
              ['Redirect loop', <>Clear <InlineCode>FORCE_HTTPS</InlineCode> or fix proxy X-Forwarded-Proto</>],
              ['Build fails on Prisma', 'Image targets linux-musl-openssl-3.0.x — rebuild without cache'],
              [
                'No admin password in logs',
                <>
                  Admin already existed, or <InlineCode>SUPER_ADMIN_EMAIL</InlineCode> unset; only printed on first create
                </>,
              ],
              ['Prisma URL error', <>DATABASE_URL must be postgresql://… (not SQL Server)</>],
            ]}
          />
          <CodeBlock className="mt-4" language="bash" code="docker compose logs -f qeva" />
          <p className="mt-4">
            More help: <Link href="/docs/support">Support</Link>. Managed hosting interest is collected on{' '}
            <a href="https://qeva.in" target="_blank" rel="noreferrer">
              qeva.in
            </a>{' '}
            — it does not provision a tenant yet.
          </p>
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-self-hosting" pageTitle="Self-hosting" />
      </div>
    </div>
  );
}
