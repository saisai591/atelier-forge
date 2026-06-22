param(
  [string]$ApplianceUrl = "http://192.168.1.57:8000",
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $RepoRoot "saas\frontend"

if (-not (Test-Path $FrontendDir)) {
  throw "Frontend introuvable: $FrontendDir"
}

Write-Host "AtelierOS - demarrage frontend local" -ForegroundColor Cyan
Write-Host "API appliance: $ApplianceUrl" -ForegroundColor Cyan

try {
  $health = Invoke-WebRequest -UseBasicParsing -Uri "$ApplianceUrl/api/health" -TimeoutSec 8
  Write-Host "API OK: $($health.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "API appliance non joignable: $ApplianceUrl/api/health" -ForegroundColor Yellow
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  Write-Host "Le frontend va demarrer, mais les donnees resteront incompletes tant que l'API ne repond pas." -ForegroundColor Yellow
}

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  Write-Host "Arret ancien process sur port ${Port}: PID $($listener.OwningProcess)" -ForegroundColor Yellow
  Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
}

$env:VITE_API_URL = $ApplianceUrl
Set-Location $FrontendDir

Write-Host "URL locale: http://localhost:$Port/" -ForegroundColor Green
npm run dev -- --host 0.0.0.0 --port $Port
