@echo off
:: ===========================================================================
:: Atelier Forge - Menu technicien (WinPE). Stocke sur le partage : modifiable sans
:: reconstruire WinPE.
:: ===========================================================================
:menu
cls
echo ===================================================================
echo    Atelier Forge  -  Environnement technicien  (reconditionnement)
echo ===================================================================
echo.
echo    [1] Deployer Windows        (partition + image + pilotes)
echo    [2] Audit rapide             (specs+SMART+batterie+RAM, qq secondes, etiquette)
echo    [3] Diagnostic disque        (SMART / etat / erreurs)
echo    [4] Effacement securise      (RGPD + certificat - repli WinPE)
echo    [5] Invite de commandes
echo    [6] Redemarrer
echo    [7] Eteindre
echo.
echo    (Pour l'effacement MATERIEL des SSD : menu PXE ^> Effacement Linux)
echo.
set "choix="
set /p choix=Votre choix [1-7] :
if "%choix%"=="1" ( call Z:\scripts\deploy.cmd & pause & goto menu )
if "%choix%"=="2" ( powershell -NoProfile -ExecutionPolicy Bypass -File Z:\scripts\audit.ps1 & pause & goto menu )
if "%choix%"=="3" ( call Z:\scripts\diag.cmd & pause & goto menu )
if "%choix%"=="4" ( powershell -NoProfile -ExecutionPolicy Bypass -File Z:\scripts\wipe.ps1 & pause & goto menu )
if "%choix%"=="5" ( cmd /k "echo Tapez 'exit' pour revenir au menu." & goto menu )
if "%choix%"=="6" wpeutil reboot
if "%choix%"=="7" wpeutil shutdown
goto menu
