<#
  Atelier Forge — Audit matériel sous WinPE.
  Collecte l'inventaire (modèle, n° de série, CPU, RAM, disques + SMART, réseau),
  écrit un rapport .txt et .json dans Z:\audit\, puis — si une imprimante ZPL
  (Zebra réseau) est configurée dans Z:\scripts\label.env — imprime une étiquette.
#>
$ErrorActionPreference = "SilentlyContinue"
$auditDir = "Z:\audit"
if (-not (Test-Path $auditDir)) { New-Item -ItemType Directory -Path $auditDir | Out-Null }

Write-Host "== Atelier Forge : audit materiel en cours ==" -ForegroundColor Cyan

# --- Collecte --------------------------------------------------------------
$bios = Get-CimInstance Win32_BIOS
$cs   = Get-CimInstance Win32_ComputerSystem
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1
$ramB = ($cs.TotalPhysicalMemory)
$ramGB = [math]::Round($ramB / 1GB, 1)

$serial = ($bios.SerialNumber).Trim()
if ([string]::IsNullOrWhiteSpace($serial) -or $serial -eq "To be filled by O.E.M.") {
    $serial = "SN-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

# Disques + santé SMART + type de bus (SATA / NVMe M.2 / RAID-RST)
$disks = foreach ($d in (Get-PhysicalDisk)) {
    $rc = $d | Get-StorageReliabilityCounter
    [pscustomobject]@{
        Modele        = $d.FriendlyName
        Bus           = $d.BusType          # SATA, NVMe, RAID (Intel RST), USB...
        Type          = $d.MediaType        # SSD / HDD
        Taille_Go     = [math]::Round($d.Size/1GB,0)
        Sante         = $d.HealthStatus
        Temp_C        = $rc.Temperature
        Heures_ON     = $rc.PowerOnHours
        Usure_pct     = $rc.Wear
        Erreurs_Lec   = $rc.ReadErrorsTotal
        Erreurs_Ecr   = $rc.WriteErrorsTotal
    }
}
# Alerte si le contrôleur est en mode RAID/RST (disque parfois invisible au déploiement).
$rstMode = [bool]($disks | Where-Object { "$($_.Bus)" -eq "RAID" })

# Batterie (portables) : usure = 1 - capacité réelle / capacité nominale.
$battery = "Aucune batterie (poste fixe)"
$batWear = $null
try {
    $bs = Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData -ErrorAction Stop
    $bf = Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity -ErrorAction Stop
    if ($bs.DesignedCapacity -and $bf.FullChargedCapacity) {
        $batWear = [math]::Round((1 - ($bf.FullChargedCapacity / $bs.DesignedCapacity)) * 100, 1)
        $battery = "Capacite nominale $($bs.DesignedCapacity) / reelle $($bf.FullChargedCapacity) mWh - usure ${batWear}%"
    }
} catch { }

# Barrettes RAM (slot, taille, fréquence, fabricant, référence)
$ramSlots = (Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum
$ramModules = foreach ($m in (Get-CimInstance Win32_PhysicalMemory)) {
    [pscustomobject]@{
        Slot       = $m.DeviceLocator
        Taille_Go  = [math]::Round($m.Capacity/1GB,0)
        Vitesse_MHz= $m.Speed
        Fabricant  = ($m.Manufacturer  -replace '\s+$','')
        Reference  = ($m.PartNumber    -replace '\s+$','')
    }
}
$ramUsed = ($ramModules | Measure-Object).Count

# TPM (éligibilité Windows 11)
$tpm = "Absent / désactivé"
try {
    $t = Get-CimInstance -Namespace root\cimv2\security\microsofttpm -ClassName Win32_Tpm -ErrorAction Stop
    if ($t) { $tpm = "Présent (v$($t.SpecVersion))" }
} catch { }

$net = Get-CimInstance Win32_NetworkAdapter -Filter "PhysicalAdapter=True AND MACAddress IS NOT NULL" |
       Select-Object -First 1
$mac = $net.MACAddress

# --- Rapport JSON ----------------------------------------------------------
$report = [pscustomobject]@{
    Date          = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    Fabricant     = $cs.Manufacturer
    Modele        = $cs.Model
    NumeroSerie   = $serial
    CPU           = $cpu.Name
    CPU_Coeurs    = $cpu.NumberOfCores
    CPU_Threads   = $cpu.NumberOfLogicalProcessors
    CPU_MHz       = $cpu.MaxClockSpeed
    Virtualisation= $cpu.VirtualizationFirmwareEnabled
    RAM_Go        = $ramGB
    RAM_Slots     = "$ramUsed / $ramSlots utilisés"
    RAM_Barrettes = $ramModules
    Disques       = $disks
    Controleur_RAID_RST = $rstMode
    Batterie      = $battery
    Batterie_Usure_pct  = $batWear
    TPM           = $tpm
    MAC           = $mac
}
$stamp = "{0}_{1}" -f ($serial -replace '[^A-Za-z0-9_-]','_'), (Get-Date -Format "yyyyMMdd-HHmmss")
$jsonPath = Join-Path $auditDir "$stamp.json"
$txtPath  = Join-Path $auditDir "$stamp.txt"
$report | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8

# --- Rapport texte lisible -------------------------------------------------
$lines = @()
$lines += "==================== AUDIT Atelier Forge ===================="
$lines += "Date         : $($report.Date)"
$lines += "Fabricant    : $($report.Fabricant)"
$lines += "Modele       : $($report.Modele)"
$lines += "N. de serie  : $($report.NumeroSerie)"
$lines += "CPU          : $($report.CPU) ($($report.CPU_Coeurs)C/$($report.CPU_Threads)T, $($report.CPU_MHz) MHz)"
$lines += "Virtualisat. : $($report.Virtualisation)   |   TPM : $($report.TPM)"
$lines += "RAM          : $($report.RAM_Go) Go  ($($report.RAM_Slots))"
foreach ($m in $ramModules) {
    $lines += ("  - {0} | {1} Go | {2} MHz | {3} {4}" -f $m.Slot,$m.Taille_Go,$m.Vitesse_MHz,$m.Fabricant,$m.Reference)
}
$lines += "Batterie     : $($report.Batterie)"
$lines += "MAC          : $($report.MAC)"
if ($rstMode) { $lines += "ATTENTION    : controleur en mode RAID/RST (disque peut etre invisible au deploiement)" }
$lines += "Disques      :"
foreach ($d in $disks) {
    $lines += ("  - {0} | bus={1} | {2} | {3} Go | sante={4} | {5}h | usure={6}%" -f `
        $d.Modele,$d.Bus,$d.Type,$d.Taille_Go,$d.Sante,$d.Heures_ON,$d.Usure_pct)
}
$lines += "======================================================"
$lines | Set-Content -Path $txtPath -Encoding UTF8
$lines | ForEach-Object { Write-Host $_ }
Write-Host "`nRapport enregistre :" -ForegroundColor Green
Write-Host "  $txtPath"
Write-Host "  $jsonPath"

# --- Impression d'etiquette (ZPL via TCP 9100) -----------------------------
$labelEnv = "Z:\scripts\label.env"
if (Test-Path $labelEnv) {
    $cfg = @{}
    Get-Content $labelEnv | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$') { $cfg[$Matches[1]] = $Matches[2] }
    }
    if ($cfg["LABEL_PRINTER_TYPE"] -eq "zpl") {
        $zhost = $cfg["LABEL_ZPL_HOST"]; $zport = [int]($cfg["LABEL_ZPL_PORT"])
        Write-Host "`nImpression de l'etiquette sur $zhost:$zport ..." -ForegroundColor Cyan
        # Etiquette simple : modele, serie, CPU/RAM, code-barres du n. de serie.
        $zpl = @"
^XA
^CF0,30
^FO20,20^FD$($report.Fabricant) $($report.Modele)^FS
^FO20,60^FDCPU: $($report.CPU)^FS
^FO20,95^FDRAM: $($report.RAM_Go) Go^FS
^FO20,140^BY2^BCN,80,Y,N,N^FD$($report.NumeroSerie)^FS
^XZ
"@
        try {
            $client = New-Object System.Net.Sockets.TcpClient($zhost, $zport)
            $stream = $client.GetStream()
            $bytes  = [System.Text.Encoding]::ASCII.GetBytes($zpl)
            $stream.Write($bytes, 0, $bytes.Length); $stream.Flush()
            $client.Close()
            Write-Host "Etiquette envoyee." -ForegroundColor Green
        } catch {
            Write-Warning "Impression impossible : $($_.Exception.Message)"
        }
    } else {
        Write-Host "`n(Imprimante non-ZPL : l'etiquette sera produite cote serveur." -ForegroundColor Yellow
        Write-Host " Voir docs/AUDIT-ETIQUETTES.md / labels/make-label.sh.)"
    }
}
