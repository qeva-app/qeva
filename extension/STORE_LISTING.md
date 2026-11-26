# Store listing copy (Chrome Web Store / Edge Add-ons)

Use with the ZIP from `pack.ps1`.

## Short description (≤132 chars)

Autofill and save logins from your self-hosted Qeva vault. Token-scoped access; no cloud telemetry.

## Detailed description

Qeva Password Manager connects your browser to your Qeva vault API.

- Autofill credentials matched to the current site (picker when multiple match)
- Optionally save new logins after you submit a form (with confirmation)
- Uses an access token from Qeva Settings (passwords:read / passwords:write)
- Works with your self-hosted or company Qeva instance

Requirements: a running Qeva server and an access token. Personal USER_MASTER vault entries stay locked until you unlock encryption in the web app.

Privacy: the extension stores your API base URL and token in local browser storage only. It does not send analytics.

## Single purpose

Password manager autofill and save for Qeva vaults.

## Privacy policy URL

https://qeva.in/privacy (or your deployment’s privacy page)

## Screenshots

Provide 1280×800 PNGs: popup connected, in-page picker, Settings token creation (web app).

## Firefox (AMO / temporary)

1. Pack ZIP with `pack.ps1` (includes `browser_specific_settings.gecko`).
2. Dev: `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`.
3. Production: submit the same ZIP to [addons.mozilla.org](https://addons.mozilla.org/developers/).
