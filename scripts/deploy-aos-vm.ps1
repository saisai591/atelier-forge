param(
  [string]$HostName = "192.168.1.57",
  [string]$User = "aos",
  [string]$KeyPath = ".\aos_deploy_ed25519",
  [string]$LocalVentoyDir = "C:\Users\Admin\Pictures\ventoy-1.1.12-windows\ventoy-1.1.12",
  [switch]$Backend
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $Root "saas\frontend"
$FrontendDist = Join-Path $FrontendDir "dist"
$FrontendArchive = Join-Path $Root "deploy-frontend-dist.tgz"
$SpaServer = Join-Path $Root "scripts\aos-dashboard-spa-server.py"
$BackendModuleDir = Join-Path $Root "saas\backend\modules\atelier_forge"
$BackendDockerfile = Join-Path $Root "saas\backend\Dockerfile"
$BackendArchive = Join-Path $Root "deploy-backend-atelier-forge.tgz"
$VentoyArchive = Join-Path $Root "deploy-ventoy-assets.tgz"
$SshTarget = "${User}@${HostName}"

if (-not (Test-Path $KeyPath)) {
  throw "Cle SSH introuvable: $KeyPath"
}

Write-Host "[AOS] Build frontend..."
Push-Location $FrontendDir
try {
  npm run build
}
finally {
  Pop-Location
}

if (Test-Path $FrontendArchive) {
  Remove-Item -LiteralPath $FrontendArchive -Force
}

Write-Host "[AOS] Creation archive frontend tar.gz..."
Push-Location $FrontendDist
try {
  tar -czf $FrontendArchive .
}
finally {
  Pop-Location
}

Write-Host "[AOS] Envoi frontend vers $SshTarget..."
scp -i $KeyPath -o StrictHostKeyChecking=no $FrontendArchive "${SshTarget}:/tmp/deploy-frontend-dist.tgz"
scp -i $KeyPath -o StrictHostKeyChecking=no $SpaServer "${SshTarget}:/tmp/aos-dashboard-spa-server.py"

$DeployFrontend = @"
set -e
rm -rf /tmp/aos-front
mkdir -p /tmp/aos-front
tar -xzf /tmp/deploy-frontend-dist.tgz -C /tmp/aos-front
sudo rm -rf /opt/aos-dashboard/*
sudo cp -a /tmp/aos-front/. /opt/aos-dashboard/
sudo cp /tmp/aos-dashboard-spa-server.py /opt/aos-dashboard/spa_server.py
sudo chown -R aos:aos /opt/aos-dashboard
test -d /opt/aos-dashboard/assets
sudo systemctl restart aos-dashboard
sudo systemctl --no-pager --plain is-active aos-dashboard
ls -la /opt/aos-dashboard
ls -la /opt/aos-dashboard/assets | head
"@

ssh -i $KeyPath -o StrictHostKeyChecking=no $SshTarget $DeployFrontend

if ($Backend) {
  if (Test-Path $BackendArchive) {
    Remove-Item -LiteralPath $BackendArchive -Force
  }

  Write-Host "[AOS] Creation archive backend atelier_forge..."
  Push-Location $BackendModuleDir
  try {
    tar -czf $BackendArchive "__init__.py" "schemas.py"
  }
  finally {
    Pop-Location
  }

  Write-Host "[AOS] Envoi backend vers $SshTarget..."
  scp -i $KeyPath -o StrictHostKeyChecking=no $BackendArchive "${SshTarget}:/tmp/deploy-backend-atelier-forge.tgz"
  scp -i $KeyPath -o StrictHostKeyChecking=no $BackendDockerfile "${SshTarget}:/tmp/deploy-backend-Dockerfile"
  ssh -i $KeyPath -o StrictHostKeyChecking=no $SshTarget "rm -f /tmp/deploy-ventoy-assets.tgz"

  $HasVentoyAssets = Test-Path $LocalVentoyDir
  if ($HasVentoyAssets) {
    if (Test-Path $VentoyArchive) {
      Remove-Item -LiteralPath $VentoyArchive -Force
    }
    Write-Host "[AOS] Creation archive assets Ventoy/AOS DISK..."
    Push-Location $LocalVentoyDir
    try {
      tar -czf $VentoyArchive .
    }
    finally {
      Pop-Location
    }
    Write-Host "[AOS] Envoi assets Ventoy/AOS DISK vers $SshTarget..."
    scp -i $KeyPath -o StrictHostKeyChecking=no $VentoyArchive "${SshTarget}:/tmp/deploy-ventoy-assets.tgz"
  }

  $DeployBackend = @"
set -e
rm -rf /tmp/aos-back
mkdir -p /tmp/aos-back
tar -xzf /tmp/deploy-backend-atelier-forge.tgz -C /tmp/aos-back
sudo cp /tmp/aos-back/__init__.py /opt/aos-backend-src/modules/atelier_forge/__init__.py
sudo cp /tmp/aos-back/schemas.py /opt/aos-backend-src/modules/atelier_forge/schemas.py
sudo cp /tmp/aos-back/__init__.py /opt/aos-backend/backend/modules/atelier_forge/__init__.py
sudo cp /tmp/aos-back/schemas.py /opt/aos-backend/backend/modules/atelier_forge/schemas.py
sudo cp /tmp/deploy-backend-Dockerfile /opt/aos-backend-src/Dockerfile
sudo cp /tmp/deploy-backend-Dockerfile /opt/aos-backend/backend/Dockerfile
if [ -f /tmp/deploy-ventoy-assets.tgz ]; then
  sudo rm -rf /opt/aos-backend-src/assets/ventoy /opt/aos-backend/backend/assets/ventoy
  sudo mkdir -p /opt/aos-backend-src/assets/ventoy /opt/aos-backend/backend/assets/ventoy
  sudo tar -xzf /tmp/deploy-ventoy-assets.tgz -C /opt/aos-backend-src/assets/ventoy
  sudo cp -a /opt/aos-backend-src/assets/ventoy/. /opt/aos-backend/backend/assets/ventoy/
fi
cd /opt/aos-backend-src
sudo podman build -t localhost/aos-backend:latest . >/tmp/aos-backend-build.log
sudo systemctl restart aos-backend
sudo systemctl --no-pager --plain is-active aos-backend
"@

  ssh -i $KeyPath -o StrictHostKeyChecking=no $SshTarget $DeployBackend
}

Write-Host "[AOS] Verification appliance..."
& (Join-Path $PSScriptRoot "verify-appliance.ps1") -HostName $HostName -SshUser $User -KeyPath $KeyPath

Write-Host "[AOS] Deploiement termine."
