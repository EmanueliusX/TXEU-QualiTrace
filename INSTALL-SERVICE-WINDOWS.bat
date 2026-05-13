@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ============================================================
echo   QualiTrace Backend - Instalare Serviciu Windows Server
echo ============================================================
echo.

:: Verifica drepturi de Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [EROARE] Rulati scriptul ca Administrator!
    pause
    exit /b 1
)

:: Verifica daca Node.js este instalat
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [EROARE] Node.js nu este instalat!
    echo Descarca de la: https://nodejs.org  (versiunea LTS)
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js detectat: %NODE_VER%

set "BE_DIR=%~dp0backend"
set "SERVICE_NAME=QualiTrace"

:: Instaleaza dependintele backend
echo.
echo [1/3] Instalare dependinte backend...
cd /d "%BE_DIR%"
call npm install --omit=dev
if %errorlevel% neq 0 (
    echo [EROARE] npm install a esuat
    pause
    exit /b 1
)
echo [OK] Dependinte instalate

:: Creeaza folderele necesare
if not exist "logs" mkdir logs
if not exist "data" mkdir data

:: Creeaza .env daca nu exista
if not exist ".env" (
    echo [INFO] Creare fisier .env din exemplu...
    copy ".env.example" ".env" >nul
    echo [ATENTIE] Editeaza %BE_DIR%\.env si schimba JWT_SECRET!
)

:: Obtine calea Node.exe
for /f "tokens=*" %%i in ('where node') do (
    set "NODE_EXE=%%i"
    goto :found_node
)
:found_node

:: Obtine calea index.js
set "SCRIPT=%BE_DIR%\src\index.js"

:: Sterge serviciu vechi daca exista
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Serviciu existent gasit - se sterge...
    sc stop "%SERVICE_NAME%" >nul 2>&1
    timeout /t 2 /nobreak >nul
    sc delete "%SERVICE_NAME%" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Creeaza Windows Service cu sc.exe + wrapper PowerShell
:: Foloseste Task Scheduler pentru pornire la boot (fara login)
echo.
echo [2/3] Inregistrare Task Scheduler pentru pornire automata...

:: Creeaza scriptul de start
set "START_PS=%BE_DIR%\start-service.ps1"
(
    echo $env:NODE_ENV = 'production'
    echo $env:PORT = '3001'
    echo $dir = '%BE_DIR:\=\\%'
    echo $logOut = Join-Path $dir 'logs\out.log'
    echo $logErr = Join-Path $dir 'logs\error.log'
    echo $proc = Start-Process -FilePath '%NODE_EXE:\=\\%' -ArgumentList '%SCRIPT:\=\\%' -WorkingDirectory $dir -RedirectStandardOutput $logOut -RedirectStandardError $logErr -NoNewWindow -PassThru
    echo $proc.Id ^| Out-File ^(Join-Path $dir 'logs\pid.txt'^)
    echo Wait-Process -Id $proc.Id
) > "%START_PS%"

:: Inregistreaza in Task Scheduler - pornire la boot, fara login, ca SYSTEM
schtasks /create /tn "QualiTrace Backend" /tr "powershell.exe -NonInteractive -ExecutionPolicy Bypass -File \"%START_PS%\"" /sc ONSTART /ru SYSTEM /rl HIGHEST /f
if %errorlevel% neq 0 (
    echo [EROARE] Nu s-a putut crea task-ul in Task Scheduler
    pause
    exit /b 1
)
echo [OK] Task Scheduler configurat

:: Porneste task-ul imediat (nu asteapta reboot)
echo.
echo [3/3] Pornire imediata a serviciului...
schtasks /run /tn "QualiTrace Backend"
timeout /t 3 /nobreak >nul

:: Verifica daca portul 3001 raspunde
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/operations' -UseBasicParsing -TimeoutSec 5; Write-Host '[OK] Backend raspunde pe portul 3001' } catch { Write-Host '[INFO] Backend pornit - poate dura cateva secunde' }"

echo.
echo ============================================================
echo   INSTALARE COMPLETA!
echo   Serviciul porneste automat la fiecare reboot (fara login)
echo   Backend ruleaza pe portul 3001
echo.
echo   Comenzi utile:
echo     schtasks /query /tn "QualiTrace Backend"  - stare task
echo     schtasks /run   /tn "QualiTrace Backend"  - pornire manuala
echo     schtasks /end   /tn "QualiTrace Backend"  - oprire
echo     type "%BE_DIR%\logs\out.log"              - loguri
echo.
echo   Fisier .env: %BE_DIR%\.env
echo   Baza de date: %BE_DIR%\data\qualitrace.db
echo ============================================================
echo.
pause
