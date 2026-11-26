# Qeva

**Self-hosted password vault** for individuals. Keep credentials on your own Postgres — with MFA, a browser extension, access tokens, and an audit trail.

This repository is the **Community (open-core)** edition: personal vault only. Company accounts, teams, SSO, and org admin tools ship separately as Enterprise.

---

## Why Qeva

| You want | Community gives you |
|----------|---------------------|
| Your data on your machine | Docker Compose + bundled or external Postgres |
| Strong account security | MFA, session controls, encryption for server-held secrets |
| Fill & save in the browser | Packaged Chrome extension (`extension/`) |
| Agents / scripts | Access tokens + `/api/v1` (CLI/MCP helpers under `agents/`) |
| Know who did what | Personal audit trail (export CSV, purge with confirmation) |

**Not in Community:** company signup, teams/RBAC, SSO, SCIM, directory sync, SIEM, Slack/Teams alerts. Those need **Qeva Enterprise** (private / managed).

Editions & boundaries: [`docs/open-core.md`](docs/open-core.md)

---

## Quick start (Docker)

**Requirements:** Docker Engine 24+, Compose v2.20+, ~1 GB RAM.

```bash
git clone https://github.com/qeva-app/qeva.git
cd qeva
cp .env.example .env
```

Edit `.env` and set at least:

- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `ENCRYPTION_KEY` — another strong secret (≥32 chars)
- `DB_PASSWORD` — Postgres password for the bundled DB
- `SUPER_ADMIN_EMAIL` — first admin login email

```bash
docker compose --profile bundled up -d --build
```

Wait for health, then grab the one-shot bootstrap password (first boot only):

```bash
docker compose ps
curl -s http://localhost:3100/api/health
docker compose logs qeva | grep QEVA_BOOTSTRAP_PASSWORD
```

Open **http://localhost:3100**, sign in with `SUPER_ADMIN_EMAIL` + that password.

Full guide (external Postgres/Supabase, TLS, extension): [`docs/self-hosting.md`](docs/self-hosting.md)

---

## What’s included (Community)

- Personal password vault (create, edit, share links, import, emergency access)
- MFA (TOTP + backup codes)
- Access tokens for API / agents / extension
- Browser extension (point at your `NEXTAUTH_URL`)
- Security scan / HIBP for your personal vault
- Audit trail for your account
- In-app docs at `/docs`

Default app port: **3100**.

---

## Local development

```bash
cp .env.example .env   # fill secrets; point DATABASE_URL at Postgres
npm install
npx prisma db push
npm run seed:all
npm run dev            # http://localhost:3100
```

Optional demo data: `npm run seed:demo`  
Checks: `npm run selfcheck`

---

## Browser extension

1. Create an access token in **Settings → Access Tokens**
2. Load `extension/` as an unpacked extension (see `extension/PUBLICATION.md`)
3. Set API base to your instance URL and paste the token

---

## Enterprise

Enterprise source is **private** (overlay + managed hosting) and is not part of this repository. Public Community images have no EE package — flipping an env var alone does not unlock Enterprise.

---

## Docs

| Doc | Purpose |
|-----|---------|
| [Self-hosting](docs/self-hosting.md) | Docker, env vars, TLS, Supabase |
| [Open-core](docs/open-core.md) | Community vs Enterprise |
| [Contributing](CONTRIBUTING.md) | Branches, PRs, no-secrets rules |
| [Security](SECURITY.md) | Vulnerability reporting |
| [GitHub settings](docs/github-settings.md) | Branch protection checklist |
| In-app `/docs` | User & admin guides |

---

## License

[MIT](LICENSE) © 2026 Gaurav Gupta

This tree is the **Community** open-core product. Enterprise implementations live in a private repo and are not shipped here.
