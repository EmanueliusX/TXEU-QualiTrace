@echo off
chcp 65001 >nul
echo ============================================================
echo   QualiTrace - Creare pachet deployment backend
echo ============================================================
echo.

set "ROOT=%~dp0"
set "OUT=%ROOT%qualitrace-backend-deploy.zip"

:: Sterge zip-ul vechi daca exista
if exist "%OUT%" del "%OUT%"

:: Foloseste PowerShell pentru a crea arhiva cu doar fisierele necesare
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = '%ROOT:\=\\%'; " ^
  "$out  = '%OUT:\=\\%'; " ^
  "$tmp  = Join-Path $env:TEMP 'qualitrace_pack'; " ^
  "if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }; " ^
  "New-Item -ItemType Directory -Path $tmp | Out-Null; " ^
  "Copy-Item '$root\INSTALL-SERVICE-WINDOWS.bat' $tmp; " ^
  "$beDst = Join-Path $tmp 'backend'; " ^
  "New-Item -ItemType Directory -Path $beDst | Out-Null; " ^
  "Copy-Item '$root\backend\package.json' $beDst; " ^
  "Copy-Item '$root\backend\.env.example' $beDst; " ^
  "Copy-Item '$root\backend\ecosystem.config.js' $beDst; " ^
  "Copy-Item '$root\backend\src' $beDst -Recurse; " ^
  "Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $out -Force; " ^
  "Remove-Item $tmp -Recurse -Force; " ^
  "Write-Host '[OK] Arhiva creata: ' -NoNewline; " ^
  "Write-Host $out"

if exist "%OUT%" (
    echo.
    echo ============================================================
    echo   GATA! Copiaza fisierul urmator pe server:
    echo   qualitrace-backend-deploy.zip
    echo.
    echo   Pe server (ca Administrator):
    echo   1. Extrage zip-ul (ex: C:\QualiTrace\)
    echo   2. Ruleaza INSTALL-SERVICE-WINDOWS.bat ca Administrator
    echo ============================================================
) else (
    echo [EROARE] Nu s-a creat arhiva.
)
echo.
pause
