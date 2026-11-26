# Builds a store-ready ZIP for Chrome Web Store / Edge Add-ons / AMO.
# Usage:  powershell -File extension/pack.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $root 'dist'
$zip = Join-Path $outDir 'qeva-extension.zip'

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$include = @(
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'icons'
)

$stage = Join-Path $outDir 'stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

foreach ($item in $include) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) { throw "Missing: $item" }
  Copy-Item $src (Join-Path $stage $item) -Recurse -Force
}

$target = $zip
try {
  if (Test-Path $zip) { Remove-Item $zip -Force -ErrorAction Stop }
} catch {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $target = Join-Path $outDir "qeva-extension-$stamp.zip"
  Write-Host "Primary zip locked; writing $target"
}

Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $target -Force
Remove-Item $stage -Recurse -Force

Write-Host "Packed: $target"
Write-Host "Next: extension/PUBLICATION.md (screenshots + store upload)."
Write-Host "Track: PENDING.md"
