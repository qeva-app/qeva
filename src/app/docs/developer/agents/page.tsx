'use client';

import Link from 'next/link';
import DocFeedbackWidget from '@/components/DocFeedbackWidget';
import { EndpointExplorer } from '@/components/docs/EndpointExplorer';
import { EqualClients } from '@/components/docs/EqualClients';
import {
  Callout,
  CodeBlock,
  DocHeader,
  DocSection,
  DocTabs,
  InlineCode,
  InteractiveChecklist,
  StepList,
} from '@/components/docs/ui';

const agentEndpoints = [
  {
    method: 'GET',
    path: '/api/v1/me',
    desc: 'Identify the acting user and token',
    scope: 'any token',
    sample: `curl -s -H "Authorization: Bearer $QEVA_TOKEN" \\\n  https://your-qeva.example/api/v1/me`,
  },
  {
    method: 'GET',
    path: '/api/v1/passwords?host=',
    desc: 'List or resolve logins by host',
    scope: 'passwords:read',
    sample: `curl -s -H "Authorization: Bearer $QEVA_TOKEN" \\\n  "https://your-qeva.example/api/v1/passwords?host=github.com"`,
  },
  {
    method: 'GET',
    path: '/api/v1/passwords/:id',
    desc: 'Reveal a secret by password id',
    scope: 'passwords:read',
  },
  {
    method: 'POST',
    path: '/api/v1/passwords',
    desc: 'Create a login',
    scope: 'passwords:write',
    sample: `curl -s -X POST -H "Authorization: Bearer $QEVA_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"GitHub","username":"you","password":"...","website":"https://github.com"}' \\\n  https://your-qeva.example/api/v1/passwords`,
  },
  {
    method: 'PUT',
    path: '/api/v1/passwords/:id',
    desc: 'Update a login',
    scope: 'passwords:write',
  },
  {
    method: 'DELETE',
    path: '/api/v1/passwords/:id',
    desc: 'Delete a login',
    scope: 'passwords:write',
  },
  {
    method: 'POST',
    path: '/api/v1/auth',
    desc: 'Validate a token',
    scope: 'validate token',
  },
];

export default function AgentsDocsPage() {
  return (
    <div>
      <DocHeader
        kicker="CLI, MCP, and automations"
        title="AI Agents"
        description="Connect agents to Qeva with the same vault ACL as humans. Token kind is for audit; scopes decide what they can do."
        actions={
          <>
            <Link href="/docs/developer/access-tokens" className="btn btn-primary btn-sm">
              Create a token
            </Link>
            <Link href="/docs/developer/api" className="btn btn-outline btn-sm">
              API reference
            </Link>
          </>
        }
      />

      <EqualClients className="mb-12" />

      <div className="space-y-12">
        <DocSection id="capabilities" title="What agents can do">
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              <>Identify user & token via <InlineCode>GET /api/v1/me</InlineCode></>,
              'List and resolve logins by host',
              'Reveal a secret by password id when encryption allows',
              'Create, update, and delete logins with write scope',
            ].map((item, i) => (
              <li
                key={i}
                className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
          <Callout variant="info" title="Still web-only">
            Admin, SSO, backup, MFA setup, share links, and workflows stay in the app.{' '}
            <InlineCode>USER_MASTER</InlineCode> secrets stay locked - same as the browser extension.
          </Callout>
        </DocSection>

        <DocSection id="token" title="Create an agent token">
          <StepList
            steps={[
              {
                title: 'Open Access Tokens',
                body: (
                  <>
                    Go to <strong>Settings → Access Tokens → New Token</strong>
                  </>
                ),
              },
              {
                title: 'Choose AI agent',
                body: 'Pick the agent client kind so audit logs label activity correctly.',
              },
              {
                title: 'Set scopes',
                body: (
                  <>
                    Enable <strong>Read passwords</strong> and/or <strong>Write passwords</strong>. Prefer
                    read-only when you can.
                  </>
                ),
              },
              {
                title: 'Copy once',
                body: (
                  <>
                    Store the value securely. Details in{' '}
                    <Link href="/docs/developer/access-tokens" className="text-primary underline underline-offset-2">
                      Access Tokens
                    </Link>
                    .
                  </>
                ),
              },
            ]}
          />
        </DocSection>

        <DocSection id="auth" title="Authenticate">
          <p>Every request uses a Bearer token:</p>
          <CodeBlock language="http" title="Header" code="Authorization: Bearer qeva_xxxxxxxxxxxx" />
        </DocSection>

        <DocSection id="endpoints" title="API v1 endpoints">
          <p>
            Expand a row for scope and a sample request. Full list:{' '}
            <Link href="/docs/developer/api" className="text-primary underline underline-offset-2">
              API reference
            </Link>
            . Secret access is audited with <InlineCode>clientKind</InlineCode>.
          </p>
          <EndpointExplorer endpoints={agentEndpoints} />
        </DocSection>

        <DocSection id="clients" title="CLI and MCP">
          <DocTabs
            defaultValue="cli"
            tabs={[
              {
                value: 'cli',
                label: 'CLI',
                content: (
                  <div className="space-y-3">
                    <p>From the Qeva repo (Node 18+):</p>
                    <CodeBlock
                      language="bash"
                      title="Terminal"
                      code={`npm run qeva -- config set --base https://your-qeva.example --token qeva_...
npm run qeva -- me
npm run qeva -- list --host github.com
npm run qeva -- get <password-id>
npm run qeva -- create --title GitHub --username you --password '...' --website https://github.com`}
                    />
                    <p>
                      Config: <InlineCode>~/.qeva/config.json</InlineCode>. Source:{' '}
                      <InlineCode>agents/qeva.mjs</InlineCode>
                    </p>
                  </div>
                ),
              },
              {
                value: 'mcp',
                label: 'MCP',
                content: (
                  <div className="space-y-3">
                    <p>Point Cursor or Claude Desktop at the stdio server:</p>
                    <CodeBlock
                      language="json"
                      title="mcp.json"
                      code={`{
  "mcpServers": {
    "qeva": {
      "command": "node",
      "args": ["/absolute/path/to/QEVA/agents/mcp-server.mjs"],
      "env": {
        "QEVA_BASE_URL": "https://your-qeva.example",
        "QEVA_TOKEN": "qeva_..."
      }
    }
  }
}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      {[
                        'qeva_me',
                        'qeva_list_passwords',
                        'qeva_get_password',
                        'qeva_create_password',
                        'qeva_update_password',
                        'qeva_delete_password',
                      ].map((t) => (
                        <span
                          key={t}
                          className="rounded-lg bg-muted px-2.5 py-1 font-mono text-[11px] text-foreground ring-1 ring-border"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                value: 'curl',
                label: 'curl',
                content: (
                  <CodeBlock
                    language="bash"
                    title="Terminal"
                    code={`export QEVA_TOKEN=qeva_...
curl -s -H "Authorization: Bearer $QEVA_TOKEN" \\
  https://your-qeva.example/api/v1/me | jq`}
                  />
                ),
              },
            ]}
          />
        </DocSection>

        <DocSection id="security" title="Security checklist">
          <p>Toggle items as you harden the setup - progress stays in this browser.</p>
          <InteractiveChecklist
            storageKey="qeva-docs-agent-security"
            items={[
              {
                id: 'short-lived',
                label: 'Prefer short-lived or revocable agent tokens; delete unused ones in Settings',
              },
              {
                id: 'least-scope',
                label: 'Give agents only the scopes they need (read-only when possible)',
              },
              {
                id: 'llm-context',
                label: 'Treat revealed secrets in LLM context like production credentials',
              },
              {
                id: 'audit',
                label: (
                  <>
                    Review audit logs for <InlineCode>clientKind: AGENT</InlineCode> activity
                  </>
                ),
              },
            ]}
          />
        </DocSection>
      </div>

      <div className="mt-10">
        <DocFeedbackWidget pageId="docs-developer-agents" pageTitle="AI Agents" />
      </div>
    </div>
  );
}
