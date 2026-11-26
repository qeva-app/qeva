# Contributing to Qeva (Community)

Thanks for helping. This repo is the **public Community** edition. Enterprise code must not land here.

## Ground rules

1. **No secrets** — never commit `.env`, keys, tokens, or real credentials. Use `.env.example` placeholders only.
2. **No Enterprise source** — SSO/SCIM/SIEM/directory-sync/alerts implementations belong in the private `qeva-enterprise` overlay, not this tree.
3. **Small PRs** — one problem per PR; keep diffs reviewable.
4. **Honest docs** — don’t claim Community has company/org features.
5. **Tests** — new non-trivial logic should leave a selfcheck assert or small script under `scripts/`.

## Branching

| Branch | Purpose |
|--------|---------|
| `main` | Stable Community; protect with required checks |
| `chore/*` / `feat/*` / `fix/*` | Day-to-day work → PR into `main` |
| `release/*` | Cut **after** `main` has the shipped commit (tags / release notes) |

Do not open `release/*` until the change is on `main`. Do not force-push `main`. Prefer rebase of feature branches onto latest `main` before merge.

## Workflow

```bash
git checkout main
git pull
git checkout -b feat/short-description
# … work …
npm run selfcheck
git push -u origin HEAD
```

Open a PR into `main`. Fill the PR template. Link issues when relevant.

## Commit messages

Use short, imperative subjects (Conventional Commits encouraged):

```
feat: add audit CSV export
fix: stop host-list audit spam from extension polls
docs: clarify Docker bootstrap password
chore: tighten gitignore for secrets
```

## Local setup

See [README.md](README.md) and [docs/self-hosting.md](docs/self-hosting.md).

```bash
cp .env.example .env   # fill secrets locally; file is gitignored
npm install
npx prisma db push
npm run seed:all
npm run dev
npm run selfcheck
```

## Code review expectations

- Correctness and security before style
- No new dependencies without a clear need
- API changes documented in `/docs` or `docs/` when user-facing

## License

Contributions are accepted under the [MIT License](LICENSE). By opening a PR you agree your contribution may be distributed under that license.
