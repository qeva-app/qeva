# Qeva Browser Extension (MV3)

Works in **Chrome**, **Microsoft Edge**, and **Firefox** (same MV3 package; Firefox needs `about:debugging` or AMO).

**Status:** not in public stores yet - use **Load unpacked** / temporary add-on below.  
**Publish when ready:** [PUBLICATION.md](./PUBLICATION.md) · [STORE_LISTING.md](./STORE_LISTING.md) · [PENDING.md](../PENDING.md).

## Local install (dev)

1. Chrome: `chrome://extensions` · Edge: `edge://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Qeva web app → **Settings → Access Tokens** → create token (`passwords:read`, `passwords:write`)
5. Extension popup → API base + token → **Save** → **Test**

## Ship as an “installer” (what users actually get)

Browsers do **not** install extensions from a normal `.exe`/`.msi` for consumers. You publish a package; the browser is the installer.

### A) Chrome Web Store (recommended for Chrome users)

1. Pack the ZIP:
   ```powershell
   powershell -File extension/pack.ps1
   ```
   Output: `extension/dist/qeva-extension.zip`
2. Create a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) (one-time fee).
3. **New item** → upload `qeva-extension.zip`.
4. Fill listing (name, screenshots 1280×800, privacy policy URL, single purpose).
5. Submit for review. After approval, share the store URL - that is the install link.

### B) Microsoft Edge Add-ons (recommended for Edge users)

1. Same ZIP from `pack.ps1`.
2. [Partner Center → Edge extensions](https://partner.microsoft.com/dashboard/microsoftedge/overview).
3. Upload ZIP, fill listing, submit.
4. Optionally enable **Chrome Web Store availability** so Edge users can install the Chrome listing too.

### C) Internal / enterprise (no public store)

IT force-installs by policy (closest thing to a company “installer”):

| Browser | Policy |
|---------|--------|
| Chrome | `ExtensionInstallForcelist` = `<extension-id>;https://clients2.google.com/service/update2/crx` (or your update URL) |
| Edge | `ExtensionInstallForcelist` (same idea via Intune / GPO) |

You still need a published extension ID (store or private self-host update XML). Unpacked folders are for developers only.

### D) Firefox (AMO or temporary)

1. Dev: `about:debugging` → **This Firefox** → **Load Temporary Add-on** → pick `extension/manifest.json`.
2. Store: upload the ZIP from `pack.ps1` to [addons.mozilla.org](https://addons.mozilla.org/developers/) (gecko id: `extension@qeva.app`).

### E) Not supported for wide distribution

- Emailing a `.crx` for manual drag-install - Chrome blocks this for security.
- A custom EXE that “installs” the extension for all users - browsers won’t allow it without policy/store.

## Pack command

```powershell
powershell -File extension/pack.ps1
```

Creates `extension/dist/qeva-extension.zip` (manifest, scripts, icons only - no README/scripts).

## Behavior (v1.1)

- Blue **q.** chip on password fields → credential picker
- Optional autofill when exactly one match
- Confirm before saving on form submit (skips duplicates)
- Popup: Test connection, list matches, Fill
- `USER_MASTER` entries stay locked until vault unlocked in the web app

## Privacy

- Token in `chrome.storage.local` only
- No analytics
- Optional host permissions requested when API base is not localhost

## After code changes

Reload the extension on `chrome://extensions` / `edge://extensions`, then refresh the page.
