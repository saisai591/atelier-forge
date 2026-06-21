$ErrorActionPreference = 'Stop'

function Section($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

Section "Detection Windows PnP"
$devices = Get-PnpDevice -PresentOnly | Where-Object {
  $_.FriendlyName -match 'EA520|Unitech|Android|ADB|MTP|WPD|Barcode|Scanner'
}

if (-not $devices) {
  Write-Host "Aucun terminal Unitech/Android detecte en PnP."
} else {
  $devices | Select-Object Class,FriendlyName,Status,InstanceId | Format-Table -AutoSize
}

Section "Details WMI"
$wmi = Get-CimInstance Win32_PnPEntity | Where-Object {
  $_.Name -match 'EA520|Unitech|Android|ADB|MTP|WPD|Barcode|Scanner'
}

if ($wmi) {
  $wmi | Select-Object Name,Manufacturer,PNPClass,DeviceID,Status | Format-List
}

Section "Mode ADB"
$adb = Get-Command adb -ErrorAction SilentlyContinue
$hasAdbInterface = $false
if ($devices) {
  $hasAdbInterface = [bool]($devices | Where-Object { $_.FriendlyName -match 'ADB' -or $_.InstanceId -match 'PID_201D|ADB' })
}

if (-not $adb) {
  Write-Host "ADB non trouve dans le PATH."
  if ($hasAdbInterface) {
    Write-Host "Bonne nouvelle: Windows voit deja une interface ADB pour l'EA520."
    Write-Host "Il manque seulement Android platform-tools cote PC."
  } else {
    Write-Host "Pour installation APK automatique: installer Android platform-tools, puis activer le debogage USB sur l'EA520."
  }
} else {
  Write-Host "ADB: $($adb.Source)"
  adb devices -l
}

Section "Recommandation AOS Deploy"
if ($hasAdbInterface -and -not $adb) {
  Write-Host "Prochaine action: installer ADB sur Windows avec scripts\\install-android-platform-tools.ps1."
} elseif (-not $hasAdbInterface) {
  Write-Host "Si EA520 apparait en WPD/MTP seulement:"
  Write-Host "1. Le terminal est connecte comme stockage/media."
  Write-Host "2. L'installation automatique APK n'est pas encore possible."
  Write-Host "3. Active Options developpeur > Debogage USB sur l'EA520."
  Write-Host "4. Rebranche le cable USB et accepte l'empreinte RSA."
  Write-Host "5. Relance ce script."
}
Write-Host ""
Write-Host "Mode conseille pour commencer: PWA mobile AOS Deploy + lecteur code-barres en mode clavier."

