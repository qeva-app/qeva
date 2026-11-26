# Equal clients: Humans & AI Agents

## Principle

Humans and agents are the **same user base** under the owning account. An agent token acts as that user - same vault ACL, same scopes - and is labeled `clientKind=AGENT` only for audit and UX.

## Surfaced (v1)

| Capability | Endpoint | Scope |
|------------|----------|-------|
| Who am I | `GET /api/v1/me` | any valid token |
| List logins | `GET /api/v1/passwords?host=` | `passwords:read` |
| Get login (+ secret) | `GET /api/v1/passwords/:id` | `passwords:read` |
| Create login | `POST /api/v1/passwords` | `passwords:write` |
| Update login | `PUT /api/v1/passwords/:id` | `passwords:write` |
| Delete login | `DELETE /api/v1/passwords/:id` | `passwords:write` |
| Validate token | `POST /api/v1/auth` | - |

Clients: browser extension (`HUMAN`), CLI, MCP (`AGENT`).

## Not surfaced (yet)

Admin, SSO, backup, MFA setup, encryption master unlock, share links, workflows, webhooks - humans use the web app; agents get the vault job first.

## Rules

- `USER_MASTER` secrets stay locked over API (no DEK in agents) - same as extension.
- Every secret return / write is audited with `clientKind` + `tokenId`.
- New tokens require at least one scope; `clientKind` is required at create (`HUMAN` \| `AGENT`).
