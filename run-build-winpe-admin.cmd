@echo off
setlocal
call "C:\Program Files (x86)\Windows Kits\10\Assessment and Deployment Kit\Deployment Tools\DandISetEnv.bat"
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Admin\Desktop\atelier-forge-backup-20260619-223536\winpe\build-winpe.ps1" -ServerIP 192.168.50.2 -SmbUser pxe -SmbPassword Saisai@13 -Arch amd64 -OutDir C:\forge-media -SkipCopype > C:\forge-winpe-build.log 2>&1
echo %ERRORLEVEL% > C:\forge-winpe-build.exit
endlocal
