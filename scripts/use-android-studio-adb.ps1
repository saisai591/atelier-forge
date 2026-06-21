$ErrorActionPreference = 'Stop'

$sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$platformTools = Join-Path $sdkPath 'platform-tools'
$adb = Join-Path $platformTools 'adb.exe'

if (-not (Test-Path $adb)) {
  throw "adb.exe introuvable dans $platformTools. Ouvre Android Studio > SDK Manager > installe Android SDK Platform-Tools."
}

Write-Host "ADB trouve: $adb" -ForegroundColor Cyan

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathParts = @()
if ($userPath) {
  $pathParts = $userPath -split ';' | Where-Object { $_ }
}

if ($pathParts -notcontains $platformTools) {
  $newPath = (($pathParts + $platformTools) -join ';')
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Host "Ajoute au PATH utilisateur: $platformTools" -ForegroundColor Green
} else {
  Write-Host "Platform-tools est deja dans le PATH utilisateur." -ForegroundColor Green
}

$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$env:Path = "$platformTools;$env:Path"

Write-Host ""
Write-Host "Version ADB:" -ForegroundColor Cyan
& $adb version

Write-Host ""
Write-Host "Terminaux connectes:" -ForegroundColor Cyan
& $adb kill-server | Out-Null
& $adb start-server | Out-Null
& $adb devices -l

Write-Host ""
Write-Host "Si l'EA520 affiche une demande d'autorisation RSA, accepte-la puis relance:" -ForegroundColor Yellow
Write-Host "  adb devices -l"

