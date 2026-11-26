# CE Docker bring-up (production image). Unsets host DATABASE_URL (localhost leaks break the container).
# Usage: powershell -File scripts/docker-up.ps1
# UI iteration: use npm run dev — do not expect Docker to hot-reload.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:DOCKER_BUILDKIT = '1'
$env:COMPOSE_DOCKER_CLI_BUILD = '1'
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

docker compose --profile bundled up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'App:  http://localhost:3100  (NODE_ENV=production)'
Write-Host 'Logs: docker compose logs -f qeva'
Write-Host 'Tip:  npm run dev for UI; Docker only when you need the production image.'
