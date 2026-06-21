<#
  Atelier Forge — Effacement (repli WinPE).
  Utilise "diskpart clean all" : réécriture de zéros sur tout le disque (1 passe).
  Produit un certificat (JSON + texte) dans Z:\certificates.

  NB : pour les SSD, l'effacement MATÉRIEL (NVMe Sanitize / ATA Secure Erase) du
  module Linux (wipe/secure-erase.sh, via SystemRescue) est PLUS FIABLE.
  Ce repli WinPE convient surtout aux disques durs mécaniques.
#>
$ErrorActionPreference = "Stop"
$certDir = "Z:\certificates"
if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir | Out-Null }

# Coordonnées société (optionnel : déposez Z:\scripts\company.env avec COMPANY_NAME=...)
$company = "Atelier"; $contact = ""
$envFile = "Z:\scripts\company.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*COMPANY_NAME\s*=\s*"?([^"]*)"?') { $company = $Matches[1] }
        if ($_ -match '^\s*COMPANY_CONTACT\s*=\s*"?([^"]*)"?') { $contact = $Matches[1] }
    }
}

Write-Host "== Atelier Forge : Effacement (WinPE / diskpart clean all) ==" -ForegroundColor Cyan
Get-Disk | Select-Object Number,FriendlyName,SerialNumber,
    @{n='Go';e={[math]::Round($_.Size/1GB,0)}},PartitionStyle | Format-Table -Auto

$num = Read-Host "Numero du disque a EFFACER"
$disk = Get-Disk -Number $num -ErrorAction SilentlyContinue
if (-not $disk) { Write-Host "Disque introuvable."; exit 1 }

$operator = Read-Host "Nom de l'operateur"
Write-Host ""
Write-Host "*** EFFACEMENT IRREVERSIBLE du disque $num : $($disk.FriendlyName) ***" -ForegroundColor Red
if ((Read-Host "Tapez EFFACER pour confirmer") -ne "EFFACER") { Write-Host "Annule."; exit 1 }

$t0 = Get-Date
$dp = "X:\wipe.txt"
"select disk $num`r`nclean all" | Set-Content -Path $dp -Encoding Ascii
Write-Host "Effacement en cours (peut etre long selon la taille)..." -ForegroundColor Yellow
$proc = Start-Process diskpart -ArgumentList "/s",$dp -Wait -PassThru -NoNewWindow
$ok = ($proc.ExitCode -eq 0)
$t1 = Get-Date

$serial = ($disk.SerialNumber); if ([string]::IsNullOrWhiteSpace($serial)) { $serial = "N/A" }
$hostSerial = (Get-CimInstance Win32_BIOS).SerialNumber
$hostModel  = (Get-CimInstance Win32_ComputerSystem).Model
$certId = "FORGE-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), (($serial -replace '[^A-Za-z0-9]','_'))
$result = if ($ok) { "SUCCES" } else { "ECHEC" }

$cert = [ordered]@{
    certificat_id        = $certId
    norme                = "NIST SP 800-88 Rev.1"
    societe              = $company
    contact              = $contact
    operateur            = $operator
    date_debut           = $t0.ToString("yyyy-MM-dd HH:mm:ss")
    date_fin             = $t1.ToString("yyyy-MM-dd HH:mm:ss")
    disque_modele        = $disk.FriendlyName
    disque_serie         = $serial
    disque_taille        = ("{0} Go" -f [math]::Round($disk.Size/1GB,0))
    methode              = "diskpart clean all (reecriture zeros, 1 passe)"
    verification         = "réécriture complète du disque"
    resultat             = $result
    machine_hote_modele  = $hostModel
    machine_hote_serie   = $hostSerial
    outil                = "Atelier Forge wipe.ps1"
}
$cert | ConvertTo-Json | Set-Content -Path (Join-Path $certDir "$certId.json") -Encoding UTF8
$cert.GetEnumerator() | ForEach-Object { "{0,-20}: {1}" -f $_.Key,$_.Value } |
    Set-Content -Path (Join-Path $certDir "$certId.txt") -Encoding UTF8

Write-Host ""
Write-Host "RESULTAT : $result" -ForegroundColor ($(if($ok){"Green"}else{"Red"}))
Write-Host "Certificat : $certDir\$certId.txt"
