# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| Community (`main` / latest Docker CE) | Yes |
| Enterprise (private / managed) | Via your Enterprise support channel |

## Reporting a vulnerability

**Do not open a public GitHub issue for security bugs.**

Email **security@qeva.app** (or the address listed on [qeva.app](https://qeva.app) if this changes) with:

- Description of the issue
- Steps to reproduce
- Affected version / commit / Docker image tag
- Impact assessment if you have one

We aim to acknowledge within **3 business days** and to provide a fix or mitigation timeline after triage.

## Self-hosted operators

- Never commit `.env`, PEM keys, or access tokens
- Rotate `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, and `JWT_SECRET` if they leak
- Keep Postgres unreachable from the public internet (Compose does not publish `5432` by default)
- Put TLS termination in front of the app in production (`NEXTAUTH_URL=https://…`)

## Scope notes

Community is an individual vault. Report issues that affect confidentiality, integrity, or availability of vault data, auth, or the public API.
