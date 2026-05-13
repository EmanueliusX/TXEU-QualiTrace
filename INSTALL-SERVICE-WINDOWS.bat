@echo off
chcp 65001 >nul

:: Auto-elevare daca nu e Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL-SERVICE-WINDOWS.ps1"

