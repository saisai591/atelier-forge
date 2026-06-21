@echo off
:: ===========================================================================
:: Atelier Forge - Diagnostic disque rapide (WinPE) : etat SMART et erreurs.
:: ===========================================================================
echo.
echo === Atelier Forge : Diagnostic disque ===
echo.
echo --- Etat SMART / sante des disques ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-PhysicalDisk | Select-Object FriendlyName,MediaType,@{n='Go';e={[math]::Round($_.Size/1GB,0)}},HealthStatus,OperationalStatus | Format-Table -Auto"
echo.
echo --- Compteurs de fiabilite (temperature, heures, usure) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-PhysicalDisk | ForEach-Object { $r=$_|Get-StorageReliabilityCounter; [pscustomobject]@{Disque=$_.FriendlyName;Temp_C=$r.Temperature;Heures=$r.PowerOnHours;Usure_pct=$r.Wear;ErrLec=$r.ReadErrorsTotal;ErrEcr=$r.WriteErrorsTotal} } | Format-Table -Auto"
echo.
echo --- Verification du systeme de fichiers (lecture seule) ---
set "VOL="
set /p VOL=Lettre de volume a verifier (ex: W) ou Entree pour passer :
if not "%VOL%"=="" chkdsk %VOL%:
echo.
echo Diagnostic termine.
goto :eof
