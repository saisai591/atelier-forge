param(
  [string]$PaperMode = "force62continuous"
)

$root = Split-Path -Parent $PSScriptRoot
$devModeTool = Join-Path $PSScriptRoot "brother-devmode.ps1"

$printers = Get-CimInstance Win32_Printer |
  Where-Object { $_.Name -match 'Brother QL' -or $_.DriverName -match 'Brother QL' } |
  Sort-Object Name

if (-not $printers) {
  throw "Aucune imprimante Brother QL detectee."
}

foreach ($printer in $printers) {
  Write-Output "== $($printer.Name) =="
  try {
    Set-CimInstance -InputObject $printer -Property @{ EnableBIDI = $false; EnableDevQueryPrint = $false } -ErrorAction SilentlyContinue
  } catch {
    Write-Warning "Impossible de desactiver BIDI/DevQuery pour $($printer.Name): $($_.Exception.Message)"
  }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $devModeTool -PrinterName $printer.Name -Mode $PaperMode
}

$preferred = $printers | Where-Object { $_.Name -eq "Brother QL-500" } | Select-Object -First 1
if (-not $preferred) {
  $preferred = $printers | Select-Object -First 1
}

$wsh = New-Object -ComObject WScript.Network
$wsh.SetDefaultPrinter($preferred.Name)
Write-Output "DefaultPrinter=$($preferred.Name)"

Get-CimInstance Win32_Printer |
  Where-Object { $_.Name -match 'Brother QL' -or $_.DriverName -match 'Brother QL' } |
  Select-Object Name, Default, EnableBIDI, EnableDevQueryPrint, PortName, DriverName
