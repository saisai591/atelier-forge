@echo off
:: ===========================================================================
:: Atelier Forge - Deploiement de Windows (WinPE).
::   - detecte UEFI vs BIOS
::   - partitionne le disque 0 (EFFACE TOUT le disque !)
::   - applique l'image .wim depuis Z:\images
::   - injecte les pilotes depuis Z:\drivers
::   - installe le chargeur de demarrage (bcdboot)
:: ===========================================================================
setlocal enabledelayedexpansion

echo.
echo === Atelier Forge : Deploiement de Windows ===
echo.

:: --- 1. Detection du firmware (UEFI ou BIOS) -------------------------------
set "FW=0x1"
for /f "tokens=3" %%a in ('reg query HKLM\System\CurrentControlSet\Control /v PEFirmwareType 2^>nul ^| find "PEFirmwareType"') do set "FW=%%a"
if /i "%FW%"=="0x2" ( set "MODE=UEFI" ) else ( set "MODE=BIOS" )
echo Firmware detecte : %MODE%
echo.

:: --- 2. Choix de l'image --------------------------------------------------
echo Images disponibles dans Z:\images :
echo ------------------------------------
dir /b Z:\images\*.wim 2>nul
if errorlevel 1 (
    echo.
    echo ERREUR : aucune image .wim trouvee dans Z:\images.
    echo Depose un install.wim dans \\serveur\deploy\images avant de lancer le deploiement.
    goto :eof
)
echo ------------------------------------
set "IMG="
set /p IMG=Nom du fichier image (ex: win11.wim) :
if not exist "Z:\images\%IMG%" (
    echo ERREUR : Z:\images\%IMG% introuvable.
    goto :eof
)
echo.
echo Editions contenues dans l'image :
dism /Get-ImageInfo /ImageFile:Z:\images\%IMG%
set "IDX=1"
set /p IDX=Index de l'edition a installer [1] :

:: --- 3. Choix du disque cible + confirmation ------------------------------
echo.
echo Disques detectes :
echo (echo list disk) > X:\lst.txt
diskpart /s X:\lst.txt
set "DISK=0"
set /p DISK=Numero du disque CIBLE [0] :
echo.
echo *********************************************************************
echo *  ATTENTION : tout le contenu du DISQUE %DISK% va etre EFFACE !     *
echo *********************************************************************
set "CONF="
set /p CONF=Tapez OUI en majuscules pour confirmer :
if not "%CONF%"=="OUI" (
    echo Annule.
    goto :eof
)

:: --- 4. Partitionnement ----------------------------------------------------
echo.
echo Partitionnement (%MODE%)...
if /i "%MODE%"=="UEFI" (
    (
        echo select disk %DISK%
        echo clean
        echo convert gpt
        echo create partition efi size=300
        echo format quick fs=fat32 label=System
        echo assign letter=S
        echo create partition msr size=16
        echo create partition primary
        echo format quick fs=ntfs label=Windows
        echo assign letter=W
    ) > X:\dp.txt
) else (
    (
        echo select disk %DISK%
        echo clean
        echo create partition primary
        echo format quick fs=ntfs label=Windows
        echo assign letter=W
        echo active
    ) > X:\dp.txt
)
diskpart /s X:\dp.txt
if errorlevel 1 ( echo ERREUR diskpart. & goto :eof )

:: --- 5. Application de l'image --------------------------------------------
echo.
echo Application de l'image (cela peut prendre plusieurs minutes)...
dism /Apply-Image /ImageFile:Z:\images\%IMG% /Index:%IDX% /ApplyDir:W:\
if errorlevel 1 ( echo ERREUR lors de l'application de l'image. & goto :eof )

:: --- 6. Injection des pilotes ---------------------------------------------
set "MODEL_DRIVER_PATH="
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cs=Get-CimInstance Win32_ComputerSystem; function S($v){(($v -replace '[^A-Za-z0-9_.-]','-') -replace '-+','-').Trim('-')}; $p='Z:\drivers\'+(S $cs.Manufacturer)+'\'+(S $cs.Model); if(Test-Path $p){$p}|Set-Content X:\driverpath.txt" >nul 2>&1
if exist X:\driverpath.txt set /p MODEL_DRIVER_PATH=<X:\driverpath.txt
if defined MODEL_DRIVER_PATH (
    echo.
    echo Injection des pilotes modele depuis "%MODEL_DRIVER_PATH%" ...
    dism /Image:W:\ /Add-Driver /Driver:"%MODEL_DRIVER_PATH%" /Recurse /ForceUnsigned
    goto drivers_done
)
if exist "Z:\drivers" (
    echo.
    echo Aucun pack modele exact trouve. Injection des pilotes generiques depuis Z:\drivers ...
    dism /Image:W:\ /Add-Driver /Driver:Z:\drivers /Recurse /ForceUnsigned
)
:drivers_done

:: --- 7. Fichier de reponse optionnel (OOBE) -------------------------------
if exist "Z:\scripts\autounattend.xml" (
    if not exist "W:\Windows\Panther" mkdir "W:\Windows\Panther"
    copy /y "Z:\scripts\autounattend.xml" "W:\Windows\Panther\unattend.xml" >nul
    echo Fichier de reponse OOBE installe.
)

:: --- 8. Chargeur de demarrage ---------------------------------------------
echo.
echo Installation du chargeur de demarrage...
if /i "%MODE%"=="UEFI" (
    bcdboot W:\Windows /s S: /f UEFI
) else (
    bcdboot W:\Windows /s W: /f BIOS
)
if errorlevel 1 ( echo ERREUR bcdboot. & goto :eof )

echo.
echo === Deploiement TERMINE avec succes. ===
echo Vous pouvez lancer un audit (menu [2]) puis redemarrer (menu [6]).
endlocal
goto :eof
