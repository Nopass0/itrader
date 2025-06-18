@echo off
setlocal enabledelayedexpansion
title Itrader Control Panel
color 0A

:MENU
cls
echo.
echo      ===================================================
echo                  ITRADER CONTROL PANEL
echo      ===================================================
echo.
echo      [1] Configure Accounts (CLI)
echo      [2] Start Trading Bot (Automatic Mode)
echo      [3] Start Trading Bot (Manual Mode)
echo      [4] Database Management
echo      [5] First Time Setup
echo      [6] View Logs
echo      [7] Exit
echo.
echo      ===================================================
echo.
set /p choice="     Select option [1-7]: "

if "%choice%"=="1" goto CLI
if "%choice%"=="2" goto AUTO
if "%choice%"=="3" goto MANUAL
if "%choice%"=="4" goto DATABASE
if "%choice%"=="5" goto SETUP
if "%choice%"=="6" goto LOGS
if "%choice%"=="7" goto EXIT
goto INVALID

:CLI
cls
echo.
echo      Starting Account Configuration...
echo.
bun run src/app.ts --cli
pause
goto MENU

:AUTO
cls
echo.
echo      Setting automatic mode...
echo.
echo mode=automatic > data\mode.txt
echo.
echo      Starting Trading Bot in AUTOMATIC mode...
echo      Press Ctrl+C to stop
echo.
bun run src/app.ts
pause
goto MENU

:MANUAL
cls
echo.
echo      Setting manual mode...
echo.
echo mode=manual > data\mode.txt
echo.
echo      Starting Trading Bot in MANUAL mode...
echo      You will need to confirm each action
echo      Press Ctrl+C to stop
echo.
bun run src/app.ts
pause
goto MENU

:DATABASE
cls
echo.
echo      Database Management
echo      ===================
echo.
echo      Opening database management menu...
echo.
bun run src/app.ts --cli
pause
goto MENU

:SETUP
cls
echo.
echo      FIRST TIME SETUP
echo      ================
echo.

REM Check if bun is installed
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo      ERROR: Bun is not installed!
    echo.
    echo      Please install Bun from https://bun.sh
    echo      Installation command: powershell -c "irm bun.sh/install.ps1 | iex"
    echo.
    pause
    goto MENU
)

echo      [1/5] Installing dependencies...
call bun install

echo.
echo      [2/5] Setting up database...
call bunx prisma generate
call bunx prisma db push

echo.
echo      [3/5] Creating directories...
if not exist "data" mkdir data
if not exist "data\cookies" mkdir data\cookies
if not exist "data\temp" mkdir data\temp

echo.
echo      [4/5] Creating .env file...
if not exist ".env" (
    echo DATABASE_URL="file:./data/database.db" > .env
)

echo.
echo      [5/5] Setup completed!
echo.
echo      Next steps:
echo      1. Run option [1] to configure accounts
echo      2. Add Gate.io accounts
echo      3. Add Bybit accounts
echo      4. Configure Gmail account
echo      5. Choose manual or automatic mode
echo.
pause
goto MENU

:LOGS
cls
echo.
echo      Recent logs (last 50 lines):
echo      ============================
echo.
if exist "app.log" (
    powershell -command "Get-Content app.log -Tail 50"
) else (
    echo      No logs found. Run the bot first to generate logs.
)
echo.
pause
goto MENU

:INVALID
echo.
echo      Invalid choice! Please select 1-7
echo.
pause
goto MENU

:EXIT
cls
echo.
echo      Thank you for using Itrader!
echo.
timeout /t 2 >nul
exit