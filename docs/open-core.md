# Qeva open-core

One codebase. Two editions. Enterprise source must not ship on the public GitHub tree.

## Repositories

| Repo | Visibility | URL |
|------|------------|-----|
| **qeva** | Public (Community) | https://github.com/qeva-app/qeva.git |
| **qeva-enterprise** | Private (EE overlay) | https://github.com/qeva-app/qeva-enterprise.git |

Clone Community and the private overlay as sibling directories, then sync with:

```powershell
powershell -File scripts/sync-open-core-repos.ps1
```

That refreshes Community (stubs for EE paths) and copies real EE files into `qeva-enterprise/overlay/`. EE/managed builds run `node qeva-enterprise/scripts/apply-overlay.js` onto a Community tree, then set `QEVA_EDITION=enterprise`.

## Editions

| | Community (public Docker) | Enterprise (private package + managed) |
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

Local monorepo default: leave unset or set `enterprise` so nothing breaks while developing.

Community Docker / public image: set `QEVA_EDITION=community`.

## Private package

- Path today: [`packages/qeva-enterprise`](../packages/qeva-enterprise/) (signal package; implementations still live under `src/` until extraction).
- Before first public GitHub push: move SSO/SCIM/directory-sync/SIEM/alerts code into that package (or a private repo), wire the public app through [`src/lib/edition.ts`](../src/lib/edition.ts) stubs only, and **do not publish** `packages/qeva-enterprise`.

## Check

```bash
QEVA_EDITION=community node scripts/selfcheck-edition.js
npm run selfcheck
```
