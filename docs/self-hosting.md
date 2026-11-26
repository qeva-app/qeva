# Self-host Qeva Community with Docker

Run Qeva on your own infrastructure. Vault data stays in your PostgreSQL volume (or external Postgres/Supabase).

**Individuals only:** the Community image (`QEVA_EDITION=community`) is a personal vault — no company signup, teams, SSO, or org admin tools. Those need Enterprise.

## Requirements

- Docker Engine 24+ and Docker Compose v2.20+ (`depends_on.required`)
- ~1 GB RAM free (Postgres Alpine is light)
- Open outbound HTTPS if you use HIBP or SMTP

## Quick start (bundled Postgres)

```bash
cp .env.example .env
# Set NEXTAUTH_SECRET, ENCRYPTION_KEY, DB_PASSWORD, SUPER_ADMIN_EMAIL
docker compose --profile bundled up -d --build
```

Wait until healthy:

```bash
docker compose ps
curl -s http://localhost:3100/api/health
```

Read the one-shot admin password (printed only on first boot):

```bash
docker compose logs qeva | grep QEVA_BOOTSTRAP_PASSWORD
```

Open `NEXTAUTH_URL` (default `http://localhost:3100`) and sign in with `SUPER_ADMIN_EMAIL` + that password.

Build with email baked into the image (optional; compose also passes it at runtime):

```bash
docker build --build-arg SUPER_ADMIN_EMAIL=admin@example.com -t qeva:ce .
```

## External Postgres / Supabase

1. Set `QEVA_DATABASE_URL` in `.env` to your Postgres or Supabase connection string (must start with `postgresql://` or `postgres://`). Do not put a localhost `DATABASE_URL` in the shell — Compose will pick it up and break the container.
2. Set `SUPER_ADMIN_EMAIL` (and secrets as above). `DB_PASSWORD` is unused when not using the bundled profile.
3. Start **without** the bundled profile:

```bash
docker compose up -d --build
```

Supabase tip: prefer the direct connection for migrations/`db push`, or the pooler URL with `?pgbouncer=true` for the app if you manage schema separately.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXTAUTH_URL` | yes | Public base URL of this instance |
| `NEXTAUTH_SECRET` | yes | Session signing |
| `ENCRYPTION_KEY` | yes | Server-held vault encryption |
| `SUPER_ADMIN_EMAIL` | yes (CE bootstrap) | Platform super-admin + first admin seed |
| `DB_PASSWORD` | bundled only | Postgres password for the sidecar |
| `QEVA_DATABASE_URL` | external only | Postgres/Supabase URL |
| `QEVA_EDITION` | no | Optional; Community images stay individual-only without the private EE overlay |
| `BOOTSTRAP_ADMIN_PASSWORD` | no | Skip auto-generate; set your own (≥10 chars) |

Full template: [`.env.example`](../.env.example).

**Production:** never set `ALLOW_DEV_OTP=true`. That bypass is for emergency/local UAT only when SMTP is unavailable.

## Browser extension

Point the extension at your API base (`NEXTAUTH_URL`). Create an access token under Settings → Access Tokens. Packaged extension: `extension/` (see `extension/PUBLICATION.md`).

## TLS / production

1. Put a reverse proxy (Caddy, nginx, Traefik) in front with a real certificate.
2. Set `NEXTAUTH_URL=https://vault.example.com`.
3. Optionally set `FORCE_HTTPS=true` so bare HTTP redirects.

Postgres port is **not** published to the host by default (compose). Keep it that way in production.

## Upgrades

```bash
git pull
docker compose --profile bundled up -d --build
```

On start the container runs `prisma db push` (schema sync). Formal migration history is not required for single-instance self-host yet — back up the `postgres-data` volume before upgrades.

## Backup

Stop or snapshot the `postgres-data` Docker volume (or your external DB backups). App logs live in `qeva-logs`.

## Managed hosting

Self-host is the supported path today. To be notified when Qeva runs hosting for you, use **Get notified** on [qeva.in](https://qeva.in) (stores an interest entry — not a live tenant).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `503` on `/api/health` | `docker compose logs postgres` — still starting / bad `DB_PASSWORD` |
| Redirect loop | Clear `FORCE_HTTPS` or fix proxy `X-Forwarded-Proto` |
| Build fails on Prisma | Image targets `linux-musl-openssl-3.0.x` — rebuild without cache |
| No admin password in logs | Admin already existed, or `SUPER_ADMIN_EMAIL` unset; only printed on first create |
| Prisma URL error | `DATABASE_URL` must be `postgresql://…` (not SQL Server) |

```bash
docker compose logs -f qeva
```
