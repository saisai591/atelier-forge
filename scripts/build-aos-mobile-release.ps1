param(
  [string]$ProjectDir = "mobile\aos-mobile-webview",
  [string]$OutputApk = "dist-mobile\AOS-Mobile-EA520-release.apk",
  [string]$KeystorePath = "dist-mobile\keystore\aos-mobile-release.jks",
  [string]$StorePassword = "AosDeployV5-ChangeMe-2026!",
  [string]$KeyAlias = "aos-mobile",
  [string]$KeyPassword = "AosDeployV5-ChangeMe-2026!"
)

$ErrorActionPreference = 'Stop'

function Section($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

Section "Verification outils"
$java = Get-Command java -ErrorAction SilentlyContinue
$keytool = Get-Command keytool -ErrorAction SilentlyContinue
$gradle = Get-Command gradle -ErrorAction SilentlyContinue
if (-not $java) { throw "Java introuvable." }
if (-not $keytool) { throw "keytool introuvable. Il est normalement fourni avec le JDK." }
if (-not $gradle) { throw "Gradle introuvable." }

Section "Keystore"
New-Item -ItemType Directory -Force -Path (Split-Path $KeystorePath) | Out-Null
if (-not (Test-Path $KeystorePath)) {
  Write-Host "Creation keystore: $KeystorePath"
  & keytool -genkeypair `
    -keystore $KeystorePath `
    -storepass $StorePassword `
    -keypass $KeyPassword `
    -alias $KeyAlias `
    -keyalg RSA `
    -keysize 4096 `
    -validity 10000 `
    -dname "CN=AOS Deploy Mobile, OU=Atelier, O=AOS Deploy, L=Paris, S=IDF, C=FR"
} else {
  Write-Host "Keystore existant: $KeystorePath"
}

Section "Build release"
Push-Location $ProjectDir
try {
  gradle.bat assembleRelease `
    "-PAOS_KEYSTORE_PATH=$((Resolve-Path "..\..\$KeystorePath").Path)" `
    "-PAOS_KEYSTORE_PASSWORD=$StorePassword" `
    "-PAOS_KEY_ALIAS=$KeyAlias" `
    "-PAOS_KEY_PASSWORD=$KeyPassword"
} finally {
  Pop-Location
}

Section "Copie APK"
$built = Join-Path $ProjectDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $built)) { throw "APK release non trouve: $built" }
New-Item -ItemType Directory -Force -Path (Split-Path $OutputApk) | Out-Null
Copy-Item -Force $built $OutputApk
Get-Item $OutputApk | Select-Object FullName,Length,LastWriteTime

Write-Host ""
Write-Host "IMPORTANT: remplace le mot de passe et conserve le keystore pour les versions client finales." -ForegroundColor Yellow
