param(
  [string]$ServerUrl = "http://192.168.1.57/mobile",
  [int]$ScreenTimeoutMs = 1800000
)

$ErrorActionPreference = 'Stop'

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) {
  $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
  if (-not $adbCommand) {
    throw "adb.exe introuvable. Lance d'abord scripts\use-android-studio-adb.ps1."
  }
  $adb = $adbCommand.Source
}

function Section($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

Section "Terminal connecte"
& $adb devices -l

Section "Configuration atelier"
Write-Host "Timeout ecran: $ScreenTimeoutMs ms"
& $adb shell settings put system screen_off_timeout $ScreenTimeoutMs

Write-Host "Ecran allume pendant USB/charge"
& $adb shell settings put global stay_on_while_plugged_in 7

Section "Infos EA520"
Write-Host "Fabricant: $(& $adb shell getprop ro.product.manufacturer)"
Write-Host "Modele: $(& $adb shell getprop ro.product.model)"
Write-Host "Android: $(& $adb shell getprop ro.build.version.release)"
& $adb shell wm size
& $adb shell wm density

Section "Ouverture AOS Deploy Mobile"
& $adb shell am start -a android.intent.action.VIEW -d $ServerUrl

Write-Host ""
Write-Host "URL ouverte: $ServerUrl" -ForegroundColor Green
Write-Host "Pour installer en raccourci: menu Chrome > Ajouter a l'ecran d'accueil."
