param(
  [string]$ProxmoxHost = "192.168.1.56",
  [string]$ApplianceHost = "192.168.1.57",
  [string]$SourcePath = "/var/lib/vz/template/iso/Win11_25H2_French_x64_v2.iso",
  [string]$DestinationPath = "/app/deploy/iso/Win11_25H2_French_x64_v2.iso",
  [string]$ProxmoxKey = ".\proxmox_codex_ed25519",
  [string]$ApplianceKey = ".\aos_deploy_ed25519"
)

$ErrorActionPreference = "Stop"

function Require-File([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "Fichier introuvable: $Path"
  }
}

Require-File $ProxmoxKey
Require-File $ApplianceKey

Write-Host "AtelierOS - import ISO Proxmox vers appliance" -ForegroundColor Cyan
Write-Host "Source: root@${ProxmoxHost}:$SourcePath"
Write-Host "Destination: aos@${ApplianceHost}:$DestinationPath"

$sourceInfo = ssh -i $ProxmoxKey -o StrictHostKeyChecking=no "root@$ProxmoxHost" "stat -c '%n|%s' '$SourcePath'"
if (-not $sourceInfo) {
  throw "Impossible de lire la source Proxmox."
}

$parts = $sourceInfo -split "\|"
$sizeBytes = [int64]$parts[1]
$sizeGb = [math]::Round($sizeBytes / 1GB, 2)
Write-Host "Taille source: $sizeGb GB" -ForegroundColor Yellow

ssh -i $ApplianceKey -o StrictHostKeyChecking=no "aos@$ApplianceHost" "sudo mkdir -p '$(dirname "$DestinationPath")' && sudo chown -R aos:aos '$(dirname "$DestinationPath")'"

Write-Host "Copie en cours. Ne ferme pas cette fenetre." -ForegroundColor Yellow
ssh -i $ProxmoxKey -o StrictHostKeyChecking=no "root@$ProxmoxHost" "cat '$SourcePath'" |
  ssh -i $ApplianceKey -o StrictHostKeyChecking=no "aos@$ApplianceHost" "cat > '$DestinationPath.import'"

ssh -i $ApplianceKey -o StrictHostKeyChecking=no "aos@$ApplianceHost" "mv '$DestinationPath.import' '$DestinationPath' && ls -lh '$DestinationPath'"

Write-Host "Import termine. Dans AtelierOS: Images WIM > Importer > Rafraichir." -ForegroundColor Green
