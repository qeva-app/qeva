# Extension publication checklist

Goal: get **Qeva Password Manager** into Chrome Web Store, Edge Add-ons, and Firefox AMO.

## 1. Pack

```powershell
cd E:\AIProjects\QEVA
powershell -File extension/pack.ps1
```

Output: `extension/dist/qeva-extension.zip`  
Includes: `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `icons/`  
(Gecko id `extension@qeva.app` is in the manifest for Firefox.)

If the zip is locked, close Explorer previews / antivirus and re-run; the script writes a timestamped zip as fallback.

## 2. Screenshots (required)

Put 1280×800 PNGs in `extension/store-assets/`:

| File | Content |
|------|---------|
| `01-popup.png` | Extension popup: API base + token saved, Test OK |
| `02-picker.png` | In-page credential picker on a login form |
| `03-token.png` | Qeva web Settings → Access Tokens (create token) |

## 3. Chrome Web Store

1. [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) (one-time fee).
2. **New item** → upload `qeva-extension.zip`.
3. Paste copy from [`STORE_LISTING.md`](STORE_LISTING.md).
4. Privacy policy: `https://qeva.in/privacy`
5. Single purpose: password manager autofill/save for Qeva.
6. Upload screenshots → submit for review.
7. After approval: save store URL in `PENDING.md` and marketing site.

## 4. Microsoft Edge Add-ons

1. Same ZIP.
2. [Partner Center → Edge extensions](https://partner.microsoft.com/dashboard/microsoftedge/overview).
3. Reuse listing copy + screenshots.
4. Optional: enable Chrome Web Store availability for Edge users.

## 5. Firefox AMO

1. [addons.mozilla.org developers](https://addons.mozilla.org/developers/).
2. Upload same ZIP (manifest has `browser_specific_settings.gecko`).
3. Dev test first: `about:debugging` → Load Temporary Add-on → `manifest.json`.

## 6. After publish

- [ ] Update [`PENDING.md`](../PENDING.md) - check off store items, paste URLs
- [ ] Update marketing site CTAs / trust badges with store links
- [ ] Update [`README.md`](README.md) with install links (replace “load unpacked” as primary for end users)
