param(
  [string]$ApkPath = "dist-mobile\AOS-Mobile-EA520-release.apk",
  [string]$ServerUrl = "http://192.168.1.57/mobile"
)

$ErrorActionPreference = 'Stop'

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) {
  $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
  if (-not $adbCommand) {
    throw "adb.exe introuvable. Lance scripts\use-android-studio-adb.ps1."
  }
  $adb = $adbCommand.Source
}

if (-not (Test-Path $ApkPath)) {
  $fallback = "dist-mobile\AOS-Mobile-EA520-debug.apk"
  if (Test-Path $fallback) {
    $ApkPath = $fallback
  } else {
    throw "APK introuvable: $ApkPath"
  }
}

Write-Host "Terminaux connectes:" -ForegroundColor Cyan
& $adb devices -l

Write-Host ""
Write-Host "Installation: $ApkPath" -ForegroundColor Cyan
$installOutput = & $adb install -r $ApkPath 2>&1
$installText = $installOutput -join "`n"
Write-Host $installText
if ($LASTEXITCODE -ne 0 -or $installText -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match') {
  Write-Host "Signature differente detectee. Desinstallation puis reinstall propre." -ForegroundColor Yellow
  & $adb uninstall fr.aosdeploy.mobile 2>$null | Out-Null
  & $adb install -r $ApkPath
}

Write-Host ""
Write-Host "Lancement AOS Mobile" -ForegroundColor Cyan
& $adb shell am start -a android.intent.action.VIEW -d $ServerUrl fr.aosdeploy.mobile/.MainActivity
