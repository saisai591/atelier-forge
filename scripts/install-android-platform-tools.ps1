$ErrorActionPreference = 'Stop'

function Section($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

Section "Verification ADB"
$adb = Get-Command adb -ErrorAction SilentlyContinue
if ($adb) {
  Write-Host "ADB deja disponible: $($adb.Source)"
  adb version
  exit 0
}

Section "Installation Android platform-tools"
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
  Write-Host "Tentative installation via winget..."
  winget install --id Google.PlatformTools --exact --accept-source-agreements --accept-package-agreements
} else {
  throw "winget introuvable. Installe Android platform-tools manuellement puis ajoute adb.exe au PATH."
}

Section "Verification apres installation"
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  Write-Host "ADB installe mais pas encore visible dans ce terminal."
  Write-Host "Ferme et rouvre PowerShell, puis lance: adb devices -l"
  exit 1
}

Write-Host "ADB disponible: $($adb.Source)"
adb version
adb devices -l

