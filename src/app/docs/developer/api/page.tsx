'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { EndpointExplorer, type Endpoint } from '@/components/docs/EndpointExplorer';
import { Callout, CodeBlock, DocHeader, DocSection, DocTabs, InlineCode } from '@/components/docs/ui';

const endpoints: Endpoint[] = [
  { method: 'POST', path: '/api/auth/register', desc: 'User registration' },
  { method: 'POST', path: '/api/auth/verify', desc: 'OTP verification' },
  { method: 'GET', path: '/api/auth/public-key', desc: 'RSA public key' },
  { method: 'GET/POST', path: '/api/passwords', desc: 'List / create passwords' },
  { method: 'GET/PUT/DELETE', path: '/api/passwords/[id]', desc: 'Password CRUD' },
  { method: 'GET', path: '/api/passwords/[id]/history', desc: 'Password history' },
  { method: 'POST', path: '/api/encryption/setup', desc: 'Setup master encryption' },
  { method: 'POST', path: '/api/encryption/unlock', desc: 'Unlock vault' },
  { method: 'POST', path: '/api/encryption/lock', desc: 'Lock vault' },
  { method: 'GET', path: '/api/encryption/status', desc: 'Encryption status' },
  { method: 'GET', path: '/api/dashboard/stats', desc: 'Dashboard statistics' },
  { method: 'GET/POST', path: '/api/teams', desc: 'List / create teams' },
  { method: 'GET/PUT/DELETE', path: '/api/teams/[id]', desc: 'Team CRUD' },
  { method: 'GET/POST/DELETE', path: '/api/teams/[id]/members', desc: 'Team members' },
  { method: 'POST', path: '/api/security/scan', desc: 'Security scan' },
  { method: 'GET/PUT', path: '/api/profile', desc: 'User profile' },
  { method: 'GET/POST', path: '/api/tokens', desc: 'API access tokens' },
  { method: 'POST', path: '/api/tokens/validate', desc: 'Validate token' },
  { method: 'POST', path: '/api/generator', desc: 'Generate password' },
  { method: 'POST', path: '/api/import/browser', desc: 'Browser import' },
  { method: 'GET', path: '/api/health', desc: 'Health check' },
  {
    method: 'POST',
    path: '/api/v1/auth',
    desc: 'API v1 token validate',
    scope: 'token',
    sample: `curl -s -X POST -H "Authorization: Bearer $QEVA_TOKEN" \\\n  https://your-qeva.example/api/v1/auth`,
  },
  {
    method: 'GET',
    path: '/api/v1/me',
    desc: 'Token whoami (human or agent)',
    scope: 'any token',
    sample: `curl -s -H "Authorization: Bearer $QEVA_TOKEN" \\\n  https://your-qeva.example/api/v1/me`,
  },
  {
    method: 'GET/POST',
    path: '/api/v1/passwords',
    desc: 'List / create (token)',
    scope: 'passwords:read | passwords:write',
  },
  {
    method: 'GET/PUT/DELETE',
    path: '/api/v1/passwords/[id]',
    desc: 'Password CRUD (token)',
    scope: 'passwords:read | passwords:write',
  },
];

export default function APIDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="81 routes across 31 domains"
        title="API Reference"
        description={
          <>
            Session cookies, Bearer tokens, and CSRF-protected mutations. For agents and MCP, start with the{' '}
            <Link href="/docs/developer/agents" className="font-medium text-primary underline underline-offset-2">
              AI agents guide
            </Link>
            .
          </>
        }
        aside={
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Prefer for machines</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">/api/v1/*</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Token auth, no CSRF, audited with <InlineCode>clientKind</InlineCode>.
            </p>
          </div>
        }
      />

      <div className="space-y-12">
        <DocSection id="authentication" title="Authentication">
          <DocTabs
            defaultValue="token"
            tabs={[
              {
                value: 'token',
                label: 'Access token',
                content: (
                  <div className="space-y-3">
                    <p>
                      Pass <InlineCode>Authorization: Bearer &lt;token&gt;</InlineCode> on every request. Best for
                      agents, CI, and extensions.
                    </p>
                    <CodeBlock
                      language="bash"
                      title="Terminal"
                      code={`curl -H "Authorization: Bearer qeva_xxxxxxxxxxxx" \\\n  https://your-qeva.example/api/v1/me`}
                    />
                  </div>
                ),
              },
              {
                value: 'session',
                label: 'Session',
                content: (
                  <p>Set automatically after login via NextAuth. Browser UI calls use the session cookie.</p>
                ),
              },
              {
                value: 'csrf',
                label: 'CSRF',
                content: (
                  <Callout variant="warn" title="Session mutations need CSRF">
                    POST / PUT / DELETE with session auth require a CSRF token. Bearer-token API v1 calls do not.
                  </Callout>
                ),
              },
            ]}
          />
        </DocSection>

        <DocSection id="endpoints" title="Key endpoints">
          <p>
            Filter and expand rows for sample requests. Prefer <InlineCode>/api/v1/*</InlineCode> for agents.
          </p>
          <EndpointExplorer endpoints={endpoints} />
        </DocSection>

        <DocSection id="errors" title="Error responses">
          <p>Errors use a consistent envelope:</p>
          <CodeBlock
            language="json"
            title="error.json"
            code={`{
  "error": "Description of the error",
  "code": "ERROR_CODE"
}`}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-developer-api" pageTitle="API Reference" />
      </div>
    </div>
  );
}
