@echo off
chcp 65001 >nul
echo ============================================================
echo   QualiTrace Backend - Instalare Serviciu Windows
echo ============================================================
echo.

:: Verifica daca Node.js este instalat
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [EROARE] Node.js nu este instalat!
    echo Descarca de la: https://nodejs.org  (versiunea LTS)
    pause
    exit /b 1
)

echo [OK] Node.js detectat: 
node --version

:: Instaleaza PM2 global
echo.
echo [1/4] Instalare PM2...
call npm install -g pm2 pm2-windows-startup
if %errorlevel% neq 0 (
    echo [EROARE] Nu s-a putut instala PM2
    pause
    exit /b 1
)
echo [OK] PM2 instalat

:: Instaleaza dependintele backend
echo.
echo [2/4] Instalare dependinte backend...
cd /d "%~dp0backend"
call npm install --omit=dev
if %errorlevel% neq 0 (
    echo [EROARE] npm install a esuat
    pause
    exit /b 1
)
echo [OK] Dependinte instalate

:: Creeaza folderul logs daca nu exista
if not exist "logs" mkdir logs

:: Creeaza .env daca nu exista
if not exist ".env" (
    echo [INFO] Creare fisier .env din exemplu...
    copy ".env.example" ".env"
    echo [ATENTIE] Editeaza backend\.env si schimba JWT_SECRET !
)

:: Porneste serviciul cu PM2
echo.
echo [3/4] Pornire serviciu QualiTrace...
call pm2 start ecosystem.config.js
call pm2 save
if %errorlevel% neq 0 (
    echo [EROARE] PM2 nu a putut porni serviciul
    pause
    exit /b 1
)
echo [OK] Serviciu pornit

:: Configureaza auto-start la boot (fara login)
echo.
echo [4/4] Configurare pornire automata la boot...
call pm2-startup install
echo [OK] Pornire automata configurata

echo.
echo ============================================================
echo   INSTALARE COMPLETA!
echo   Backend ruleaza pe portul 3001
echo   
echo   Comenzi utile:
echo     pm2 status          - stare serviciu
echo     pm2 logs qualitrace-backend  - loguri live
echo     pm2 restart qualitrace-backend  - restart
echo     pm2 stop qualitrace-backend     - oprire
echo ============================================================
echo.
pause
