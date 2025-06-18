@echo off
title Itrader - P2P Trading Automation

echo ================================
echo Itrader - P2P Trading Automation
echo ================================
echo.
echo Select startup option:
echo 1) CLI - Manage accounts and settings
echo 2) Run - Start automation
echo 3) Exit
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo Starting CLI...
    bun run src/app.ts --cli
) else if "%choice%"=="2" (
    echo Starting automation...
    bun run src/app.ts
) else if "%choice%"=="3" (
    echo Exiting...
    exit
) else (
    echo Invalid choice. Exiting...
    pause
    exit
)

pause