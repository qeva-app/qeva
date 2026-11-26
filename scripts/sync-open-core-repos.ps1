# Sync this monorepo → E:\GITHUB\qeva (Community) + E:\GITHUB\qeva-enterprise (EE overlay).
# Run from repo root: powershell -File scripts/sync-open-core-repos.ps1
$ErrorActionPreference = 'Stop'

$Source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Community = 'E:\GITHUB\qeva'
$Enterprise = 'E:\GITHUB\qeva-enterprise'

if (-not (Test-Path (Join-Path $Community '.git'))) { throw "Missing clone: $Community" }
if (-not (Test-Path (Join-Path $Enterprise '.git'))) { throw "Missing clone: $Enterprise" }

$EeRel = @(
  'src\lib\sso.ts',
  'src\lib\scim.ts',
  'src\lib\directory-sync.ts',
  'src\lib\microsoft-graph.ts',
  'src\components\SSOConfiguration.tsx',
  'src\components\DirectorySyncPanel.tsx',
  'src\app\api\admin\siem\export\route.ts',
  'src\app\api\admin\alerts\route.ts',
  'src\app\api\admin\scim\route.ts',
  'src\app\api\scim\v2\Users\route.ts',
  'src\app\api\scim\v2\Users\[id]\route.ts',
  'src\app\api\admin\directory-sync\route.ts',
  'src\app\api\admin\directory-sync\sync\route.ts',
  'src\app\api\admin\directory-sync\test\route.ts',
  'src\app\api\admin\sso\configs\route.ts',
  'src\app\api\admin\sso\configs\[id]\route.ts',
  'src\app\api\admin\sso\configs\[id]\activate\route.ts',
  'src\app\api\admin\sso\configs\[id]\test\route.ts',
  'src\app\api\sso\configs\route.ts',
  'src\app\api\sso\configs\[id]\route.ts',
  'src\app\api\sso\providers\route.ts'
)

Write-Host "1) Robocopy Community shell → $Community"
& robocopy $Source $Community /E `
  /XD node_modules .next .git logs certs coverage .turbo `
  /XF .env .env.bak *.pem `
  /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
# robocopy exit 0-7 = success-ish
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }
# also drop extension build artifacts if present
$extDist = Join-Path $Community 'extension\dist'
if (Test-Path $extDist) { Remove-Item -Recurse -Force $extDist }

# Never ship private EE package or local planning noise as “source of truth” for public
$removeFromCommunity = @(
  'packages\qeva-enterprise',
  '.planning'
)
foreach ($rel in $removeFromCommunity) {
  $p = Join-Path $Community $rel
  if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}

Write-Host "2) Copy EE overlay → $Enterprise\overlay"
$overlayRoot = Join-Path $Enterprise 'overlay'
if (Test-Path $overlayRoot) { Remove-Item -Recurse -Force $overlayRoot }
New-Item -ItemType Directory -Path $overlayRoot | Out-Null
foreach ($rel in $EeRel) {
  $src = Join-Path $Source $rel
  if (-not (Test-Path -LiteralPath $src)) { throw "Missing EE file: $rel" }
  $dest = Join-Path $overlayRoot $rel
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path -LiteralPath $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  }
  Copy-Item -LiteralPath $src -Destination $dest -Force
}

Write-Host "3) Write Community stubs over EE paths in $Community"
& (Join-Path $PSScriptRoot 'write-community-stubs.ps1') -CommunityRoot $Community

Write-Host "3b) Enterprise package metadata"
Set-Content (Join-Path $Enterprise 'package.json') @'
{
  "name": "@qeva/enterprise",
  "version": "0.1.0",
  "private": true,
  "description": "Qeva Enterprise overlay — apply onto Community for SSO/SCIM/SIEM/alerts/directory sync",
  "main": "index.js",
  "license": "UNLICENSED",
  "scripts": {
    "apply": "node scripts/apply-overlay.js"
  }
}
'@
Set-Content (Join-Path $Enterprise 'index.js') @'
module.exports = {
  edition: 'enterprise',
  features: ['sso', 'scim', 'directory_sync', 'siem', 'alerts'],
};
'@

$eeScripts = Join-Path $Enterprise 'scripts'
New-Item -ItemType Directory -Force -Path $eeScripts | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'apply-enterprise-overlay.js') (Join-Path $eeScripts 'apply-overlay.js') -Force

Set-Content (Join-Path $Enterprise 'README.md') @'
# qeva-enterprise (private)

Enterprise **overlay** for [qeva](https://github.com/qeva-app/qeva) (public Community).

## Ship model

1. Develop in private monorepo (`qeva-dev` / AIProjects/QEVA).
2. Run `scripts/sync-open-core-repos.ps1` → refreshes:
   - `E:\GITHUB\qeva` (Community + stubs)
   - `E:\GITHUB\qeva-enterprise/overlay` (real EE files)
3. Push each repo to GitHub separately (do not force-push secrets).

## Apply onto Community (EE / managed image)

```bash
cd E:\GITHUB\qeva
node ..\qeva-enterprise\scripts\apply-overlay.js
set QEVA_EDITION=enterprise
```

Overlay copies `overlay/**` onto the Community tree (same relative paths), replacing stubs.
'@

Write-Host "4) Community edition defaults"
$envExample = Join-Path $Community '.env.example'
if (Test-Path $envExample) {
  $t = Get-Content $envExample -Raw
  $t = $t -replace '(?m)^# QEVA_EDITION=enterprise\s*$', 'QEVA_EDITION=community'
  if ($t -notmatch '(?m)^QEVA_EDITION=') {
    $t = "QEVA_EDITION=community`r`n`r`n" + $t
  }
  Set-Content -Path $envExample -Value $t -NoNewline
}

$compose = Join-Path $Community 'docker-compose.yml'
if (Test-Path $compose) {
  (Get-Content $compose -Raw) -replace 'QEVA_EDITION: \$\{QEVA_EDITION:-enterprise\}', 'QEVA_EDITION: ${QEVA_EDITION:-community}' |
    Set-Content $compose -NoNewline
}

$editionTs = Join-Path $Community 'src\lib\edition.ts'
if (Test-Path $editionTs) {
  $e = Get-Content $editionTs -Raw
  $e = $e -replace "const edition: QevaEdition = fromEnv \?\? 'enterprise';",
    "const edition: QevaEdition = fromEnv ?? (pkg ? 'enterprise' : 'community');"
  $e = $e -replace '(?s)// shortcut: default enterprise.*?\r?\n', ''
  Set-Content $editionTs -Value $e -NoNewline
}

Write-Host "Done."
Write-Host "  Community:  $Community"
Write-Host "  Enterprise: $Enterprise\overlay ($($EeRel.Count) files)"
