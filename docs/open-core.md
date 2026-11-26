# Qeva open-core

One product. Two editions. **Enterprise source must not ship on the public GitHub tree.**

## Repositories

| Edition | Visibility | What’s public |
|---------|------------|---------------|
| **Community** (this repo) | Public | Individual vault, Docker image, stubs for EE paths |
| **Enterprise** | Private / managed | Company accounts, SSO, SCIM, directory sync, SIEM, alerts |

Community ships stubs for SSO, SCIM, directory sync, SIEM, alerts, and company/org admin APIs. Real implementations are applied only in private Enterprise builds.

## Editions

| | Community (public Docker) | Enterprise (private / managed) |
|--|--------------------|----------------------------------------|
| Individual vault + MFA | Yes | Yes |
| Company / organization accounts | No | Yes |
| Teams, RBAC, org workflows | No | Yes |
| Access tokens, `/api/v1`, CLI/MCP, extension | Yes | Yes |
| Import, share links, emergency access | Yes | Yes |
| Security scan / HIBP (server-held) | Personal vault | Yes (org too) |
| SSO (Azure AD / Google / Okta) | No | Yes |
| SCIM | No | Yes |
| Directory sync (Graph → teams) | No | Yes |
| SIEM audit export / push | No | Yes |
| Slack / Teams alert channels | No | Yes |
| Managed hosting control plane | N/A | Managed only (never OSS) |

## How edition is chosen

1. `QEVA_EDITION=community|enterprise` (env wins when set).
2. Else: if `@qeva/enterprise` resolves → `enterprise`.
3. Else → `community`.

Public Community images have **no** Enterprise package. Leave env unset or `community`. Flipping the env alone does not add Enterprise source.

## Check

```bash
QEVA_EDITION=community node scripts/selfcheck-edition.js
npm run selfcheck
```
