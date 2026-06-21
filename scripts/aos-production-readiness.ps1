$ErrorActionPreference = 'Stop'

function Section($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

Section "Fichiers principaux"
$required = @(
  "saas\frontend\src\pages\PxeControl.tsx",
  "saas\frontend\src\pages\MobileScanner.tsx",
  "mobile\aos-mobile-webview\app\src\main\java\fr\aosdeploy\mobile\MainActivity.java",
  "dist-mobile\AOS-Mobile-EA520-release.apk",
  "docs\CLIENT_INSTALL_GUIDE.md"
)
foreach ($path in $required) {
  if (Test-Path $path) {
    Write-Host "OK   $path" -ForegroundColor Green
  } else {
    Write-Host "MISS $path" -ForegroundColor Red
  }
}

Section "Recherche valeurs a durcir avant vente"
$patterns = @(
  "Demo1234!",
  "ChangeMe123!",
  "change-me-in-production",
  "aos-dev-local-change-before-production",
  "192.168.1.57",
  "DEBUG=true"
)
foreach ($pattern in $patterns) {
  $matches = rg -n --fixed-strings $pattern saas server scripts mobile docs 2>$null
  if ($matches) {
    Write-Host ""
    Write-Host "A traiter: $pattern" -ForegroundColor Yellow
    $matches | Select-Object -First 12
  }
}

Section "Build rapide"
Push-Location "saas\frontend"
try {
  npx.cmd tsc --noEmit
} finally {
  Pop-Location
}

Section "APK release"
if (Test-Path "dist-mobile\AOS-Mobile-EA520-release.apk") {
  Get-Item "dist-mobile\AOS-Mobile-EA520-release.apk" | Select-Object FullName,Length,LastWriteTime
} else {
  Write-Host "APK release absent." -ForegroundColor Red
}

