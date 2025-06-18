@echo off
title Itrader

echo.
echo ==========================================
echo           Itrader Application
echo ==========================================
echo.
echo Choose an option:
echo 1. Run CLI (Configure accounts)
echo 2. Run Application (Start automation)
echo 3. Setup Gmail OAuth
echo 4. Exit
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Starting CLI mode...
    bun run cli
) else if "%choice%"=="2" (
    echo.
    echo Starting application...
    bun run start
) else if "%choice%"=="3" (
    echo.
    echo Starting Gmail setup...
    bun run setup:gmail
) else if "%choice%"=="4" (
    echo.
    echo Goodbye!
    exit /b 0
) else (
    echo.
    echo Invalid choice. Please run again.
    pause
    exit /b 1
)

pause