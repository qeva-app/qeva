# Qeva — Integration features (internal roadmap)

> Internal planning doc — not end-user documentation. Product docs live under `/docs` in the app.

Product: enterprise password vault. Integrations should reinforce **identity sync**, **autofill where logins happen**, and **auditable sharing** — not a grab-bag of SaaS logos.

## Already in place

| Area | Status |
|------|--------|
| Access tokens + `/api/v1` (passwords read/write) | Done |
| Equal human/agent clients (`clientKind`, `/api/v1/me`, password CRUD, CLI + MCP) | Done |
| Chrome extension (MV3) — autofill / save | Done (Firefox/Edge packaging open) |
| SSO configuration model (SAML/OIDC providers) | Partial — Azure AD / Google / Okta OIDC login wired |
| Browser CSV/JSON import + Bitwarden/1Password/LastPass | Done |
| Share links (time / view limited) | Done |
| Emergency access | Done |
| Org workflows hub (`/workflows`) — member checklists + admin builder | Done (v1) |
| Users: Reports to + Graph sync (deactivate/groups→teams) + SCIM Users | Done |
| Webhooks API surface + Slack/Teams alerts + SIEM export | Done (HMAC webhooks; in-process retry) |
| Weekly email summary | Done |
| Backup / DB connections | Done |
| MFA | Done |

---

## Priority roadmap

### P0 — Browser extension (current focus)

- [x] Solid Chrome MV3: connect via access token, match host → credentials
- [x] In-page picker (don’t blind-autofill the first match)
- [x] Confirm before saving a login from form submit
- [x] Popup: test connection, list matches for current tab, Fill
- [x] Skip duplicate saves (same host + username)
- [x] Unlock hint when only `USER_MASTER` entries match
- [x] Firefox gecko id + Edge/Chrome pack docs (`pack.ps1`, STORE_LISTING.md)
- [ ] Store submission (manual) — see `PENDING.md` + `extension/PUBLICATION.md`

### P1 — Identity & org

- [x] SCIM 2.0 Users API (`/api/scim/v2/Users`) + admin token rotate
- [x] Azure AD / Google / Okta OIDC sign-in (SAML/LDAP/generic OAuth still deferred)
- [x] Directory sync — Entra groups → Qeva teams; deactivate missing/disabled

### P2 — Collaboration alerts

- [x] Real webhooks: `password.created`, `password.rotated`, `share.viewed`, `emergency.requested`
- [x] Slack / Teams incoming webhook channels (`/api/admin/alerts`)
- [ ] Richer Slack Bot (beyond incoming webhooks)

### P3 — Engineer surfaces

- [x] CLI (`qeva …`) + MCP on access tokens + `/api/v1`
- [x] `/api/v1` whoami + get/update/delete by id + audit `clientKind`
- [ ] Stronger `/api/v1` (pagination, filter by team, host allowlists on tokens)
- [ ] CI short-lived secret inject (GitHub Actions / GitLab) — scoped + audited

### P4 — Security ecosystem

- [x] HIBP k-anonymity breach check in security scan (USER_MASTER excluded)
- [x] SIEM audit export NDJSON + optional HTTPS push (`/api/admin/siem/export`)
- [x] Broader import formats (Bitwarden JSON / 1Password / LastPass CSV)

### Later

- [ ] Desktop / mobile companions (OS unlock + autofill)
- [ ] Notion / Confluence “request access” → share flow
- [ ] MDM policies (force extension / SSO-only)

---

## Workflows v2 (enterprise checklists)

**Product intent:** org-only guided checklists — onboarding and custom runs — with an allowlisted set of step actions (open a page, mark info done, auto-complete when the user already did the thing). Not arbitrary scripts or endpoint-driven automation.

### Shipped (Phase 1)

- [x] Top-level **Workflows** nav → `/workflows`
- [x] Member hub: **My checklists** (progress, mark complete, dismiss optional)
- [x] Admin hub: **Manage** tab (create / edit / activate workflows + steps)
- [x] Legacy `/onboarding` redirects to `/workflows`
- [x] Banner + API deep-links use `/workflows?workflow=…`
- [x] Builder removed from Settings (lives only under Workflows → Manage)
- [x] Per-user assignment (admins → any member; managers → direct reports); audience `ASSIGNED`

### Step model (fixed)

| Type | Behavior |
|------|----------|
| `INFO` | Read + mark done |
| `LINK` | Open `href` (in-app path) + mark done |
| `ACTION` | Allowlisted `actionKey` (e.g. enable encryption, join team, add password); some auto-complete from vault state |

### Next (Phase 2+)

- [ ] Templates library (security hygiene, offboarding, quarterly access review)
- [ ] Audience by team / role beyond ALL / USER / ADMIN
- [ ] Admin progress dashboard (who is stuck) beyond per-workflow panel
- [ ] Notifications when a required workflow is assigned
- [ ] Keep action keys allowlisted — never free-form HTTP/script steps

---

## Non-goals (for now)

- Becoming a full HashiCorp Vault / cloud KMS replacement
- Integrating every SaaS for logo density
- Storing client DEKs inside the extension (zero-knowledge stays in the web app)
- Arbitrary workflow scripts or calling arbitrary APIs from steps

## Suggested build order (remaining)

1. **Extension store submission** (MVP shipped; packaging leftover)  
2. **Workflows Phase 2** (templates + progress visibility)  
3. **Richer Slack Bot** (incoming webhooks shipped)  
4. **Stronger `/api/v1`** (pagination, team filter, host allowlists)  
5. **CI short-lived secret inject** (CLI/MCP shipped)
