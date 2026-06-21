<#
.SYNOPSIS
    Atelier Forge — Construit l'image WinPE de déploiement (à exécuter SOUS WINDOWS).

.DESCRIPTION
    À lancer depuis "Environnement des outils de déploiement et de création
    d'images" (installé avec le Windows ADK + module complémentaire WinPE).

    Le script :
      1. crée un espace de travail WinPE (copype) ;
      2. ajoute les composants utiles à l'audit (PowerShell, WMI, StorageWMI) ;
      3. injecte un startnet.cmd qui monte le partage \\<serveur>\deploy
         et lance le menu technicien ;
      4. (optionnel) injecte des pilotes dans le boot.wim WinPE ;
      5. produit un dossier "media" à copier sur le serveur, dans
         <HTTP_ROOT>/winpe/  (pour le démarrage réseau via wimboot).

.EXAMPLE
    .\build-winpe.ps1 -ServerIP 192.168.1.10 -SmbUser pxe -SmbPassword pxe `
        -OutDir C:\forge-winpe -WinpeDriversPath C:\pilotes-winpe
#>
param(
    [Parameter(Mandatory=$true)][string]$ServerIP,
    [string]$SmbUser = "pxe",
    [string]$SmbPassword = "pxe",
    [string]$Arch = "amd64",
    [string]$WorkDir = "$env:TEMP\forge-winpe-build",
    [string]$OutDir  = "$env:USERPROFILE\Desktop\forge-media",
    # Pilotes à injecter DANS WinPE (cartes réseau/stockage récentes).
    # NB : différent des pilotes du Windows déployé (eux vont dans \deploy\drivers).
    [string]$WinpeDriversPath = "",
    [switch]$SkipCopype
)
$ErrorActionPreference = "Stop"

function Need($cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "'$cmd' introuvable. Lancez ce script depuis l'environnement ADK/WinPE."
    }
}
if (-not $SkipCopype) { Need copype }
Need dism

Write-Host "==> Création de l'espace de travail WinPE ($Arch)" -ForegroundColor Cyan
if (-not $SkipCopype) {
    if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
    & copype $Arch $WorkDir
} else {
    Write-Host "==> Reprise de l'espace de travail WinPE existant ($WorkDir)" -ForegroundColor Cyan
}

$bootWim = Join-Path $WorkDir "media\sources\boot.wim"
$mount   = Join-Path $WorkDir "mount"
New-Item -ItemType Directory -Force -Path $mount | Out-Null

Write-Host "==> Montage de boot.wim" -ForegroundColor Cyan
Mount-WindowsImage -ImagePath $bootWim -Index 1 -Path $mount | Out-Null

# Recherche des paquets WinPE optionnels dans l'ADK.
$pkgRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\Assessment and Deployment Kit\Windows Preinstallation Environment\$Arch\WinPE_OCs"
$packages = @(
    "WinPE-WMI.cab","en-us\WinPE-WMI_en-us.cab",
    "WinPE-NetFX.cab","en-us\WinPE-NetFX_en-us.cab",
    "WinPE-Scripting.cab","en-us\WinPE-Scripting_en-us.cab",
    "WinPE-PowerShell.cab","en-us\WinPE-PowerShell_en-us.cab",
    "WinPE-StorageWMI.cab","en-us\WinPE-StorageWMI_en-us.cab",
    "WinPE-DismCmdlets.cab","en-us\WinPE-DismCmdlets_en-us.cab"
)
Write-Host "==> Ajout des composants WinPE (PowerShell, WMI, StorageWMI...)" -ForegroundColor Cyan
foreach ($p in $packages) {
    $cab = Join-Path $pkgRoot $p
    if (Test-Path $cab) {
        Add-WindowsPackage -Path $mount -PackagePath $cab | Out-Null
        Write-Host "    + $p"
    } else {
        Write-Warning "Paquet introuvable (ignoré) : $cab"
    }
}

# Injection éventuelle de pilotes DANS WinPE.
if ($WinpeDriversPath -and (Test-Path $WinpeDriversPath)) {
    Write-Host "==> Injection des pilotes WinPE depuis $WinpeDriversPath" -ForegroundColor Cyan
    Add-WindowsDriver -Path $mount -Driver $WinpeDriversPath -Recurse -ForceUnsigned | Out-Null
}

# startnet.cmd : monte le partage et lance le menu (logique stockée sur le serveur).
Write-Host "==> Écriture de startnet.cmd" -ForegroundColor Cyan
$startnet = @"
@echo off
wpeinit
echo Atelier Forge - Initialisation reseau...
ping -n 6 127.0.0.1 >nul
set SERVER=$ServerIP
:retry
net use Z: \\%SERVER%\deploy /user:$SmbUser $SmbPassword >nul 2>&1
if errorlevel 1 (
  echo Partage indisponible, nouvel essai dans 3s...
  ping -n 4 127.0.0.1 >nul
  goto retry
)
echo Partage \\%SERVER%\deploy monte sur Z:
call Z:\scripts\menu.cmd
"@
Set-Content -Path (Join-Path $mount "Windows\System32\startnet.cmd") -Value $startnet -Encoding Ascii

Write-Host "==> Démontage (validation des modifications)" -ForegroundColor Cyan
Dismount-WindowsImage -Path $mount -Save | Out-Null

Write-Host "==> Copie du dossier media vers $OutDir" -ForegroundColor Cyan
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
Copy-Item (Join-Path $WorkDir "media") $OutDir -Recurse

Write-Host ""
Write-Host "TERMINÉ." -ForegroundColor Green
Write-Host "Copiez le contenu de '$OutDir' dans <HTTP_ROOT>/winpe/ sur le serveur :"
Write-Host "  $OutDir\  ->  /var/lib/forge/http/winpe/media/"
Write-Host "(on doit obtenir .../winpe/media/sources/boot.wim, .../media/Boot/BCD, boot.sdi)"
