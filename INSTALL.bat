@echo off
echo ========================================
echo   QualiTrace - Quality Control System
echo ========================================
echo.

echo [1/2] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (echo ERROR: Backend install failed & pause & exit /b 1)
cd ..

echo.
echo [2/2] Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (echo ERROR: Frontend install failed & pause & exit /b 1)
cd ..

echo.
echo ========================================
echo   Installation complete!
echo   Run START.bat to launch the application
echo ========================================
pause
