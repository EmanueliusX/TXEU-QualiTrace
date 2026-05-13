@echo off
echo ========================================
echo   QualiTrace - Starting Services
echo ========================================
echo.
echo Starting backend API on http://localhost:3001 ...
start "QualiTrace Backend" cmd /k "cd /d %~dp0backend && npm run dev"

echo Waiting 2 seconds for backend to start...
timeout /t 2 /nobreak > nul

echo Starting frontend on http://localhost:5173 ...
start "QualiTrace Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   QualiTrace is running!
echo.
echo   Operator:  http://localhost:5173
echo   Admin:     http://localhost:5173/login
echo   API:       http://localhost:3001/api
echo.
echo   Default Admin: ADMIN001 / 1234
echo ========================================
echo.
echo Opening browser...
timeout /t 3 /nobreak > nul
start http://localhost:5173
