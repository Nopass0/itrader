@echo off
setlocal enabledelayedexpansion

:: Colors (using ANSI escape codes - requires Windows 10 1909+)
set "RED=[31m"
set "GREEN=[32m"
set "YELLOW=[33m"
set "BLUE=[34m"
set "CYAN=[36m"
set "NC=[0m"

:: Enable ANSI colors in Windows 10+
for /f "tokens=3" %%a in ('ver') do set version=%%a
set version=%version:.=%
if %version% geq 10017134 (
    :: Windows 10 1803+ supports ANSI colors
) else (
    :: Disable colors for older Windows
    set "RED="
    set "GREEN="
    set "YELLOW="
    set "BLUE="
    set "CYAN="
    set "NC="
)

:SHOW_HEADER
cls
echo %CYAN%╔═══════════════════════════════════════╗%NC%
echo %CYAN%║       iTrader Server Manager          ║%NC%
echo %CYAN%║     P2P Trading Automation System     ║%NC%
echo %CYAN%╚═══════════════════════════════════════╝%NC%
echo.
goto :eof

:CHECK_DEV_SERVER
tasklist /FI "IMAGENAME eq bun.exe" 2>NUL | find /I "bun.exe" >NUL
if %ERRORLEVEL% equ 0 (
    exit /b 0
) else (
    tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I "node.exe" >NUL
    if %ERRORLEVEL% equ 0 (
        exit /b 0
    ) else (
        exit /b 1
    )
)

:STOP_DEV_SERVER
echo %YELLOW%Stopping development server...%NC%
taskkill /F /IM bun.exe 2>NUL
taskkill /F /IM node.exe 2>NUL
timeout /t 2 /nobreak >NUL
echo %GREEN%Development server stopped%NC%
goto :eof

:MANAGE_ACCOUNTS
:ACCOUNT_MENU
call :SHOW_HEADER
echo %BLUE%Account Management%NC%
echo ==================
echo.
echo 1) Create/Reset Admin Account
echo 2) Create Operator Account  
echo 3) List All Accounts
echo 4) Reset Account Password
echo 5) Delete Account
echo 6) Back to Main Menu
echo.
set /p account_choice="Enter your choice (1-6): "

if "%account_choice%"=="1" goto CREATE_ADMIN
if "%account_choice%"=="2" goto CREATE_OPERATOR
if "%account_choice%"=="3" goto LIST_ACCOUNTS
if "%account_choice%"=="4" goto RESET_PASSWORD
if "%account_choice%"=="5" goto DELETE_ACCOUNT
if "%account_choice%"=="6" goto :eof

echo %RED%Invalid choice!%NC%
pause
goto ACCOUNT_MENU

:CREATE_ADMIN
echo.
echo %CYAN%Creating/Resetting Admin Account%NC%
echo --------------------------------
set /p admin_user="Enter admin username (default: admin): "
if "%admin_user%"=="" set admin_user=admin

set /p admin_pass="Enter admin password: "
set /p admin_pass_confirm="Confirm password: "

if not "%admin_pass%"=="%admin_pass_confirm%" (
    echo %RED%Passwords do not match!%NC%
    pause
    goto ACCOUNT_MENU
)

bun run create-admin-account.ts %admin_user% %admin_pass%
echo %GREEN%Admin account created/updated successfully!%NC%
pause
goto ACCOUNT_MENU

:CREATE_OPERATOR
echo.
echo %CYAN%Creating Operator Account%NC%
echo ------------------------
set /p op_user="Enter operator username: "

:: Create operator account using manage-webserver-accounts.ts
:: This will prompt for password interactively
bun run manage-webserver-accounts.ts create %op_user% operator
pause
goto ACCOUNT_MENU

:LIST_ACCOUNTS
echo.
echo %CYAN%System Accounts%NC%
echo ---------------
bun run manage-webserver-accounts.ts list
echo.
pause
goto ACCOUNT_MENU

:RESET_PASSWORD
echo.
echo %CYAN%Reset Account Password%NC%
echo ---------------------
set /p reset_user="Enter username: "

:: Check if it's an admin account (use reset-admin-password.ts)
:: or a regular account (use manage-webserver-accounts.ts)
if "%reset_user%"=="admin" (
    set /p new_pass="Enter new password: "
    set /p new_pass_confirm="Confirm new password: "
    
    if not "!new_pass!"=="!new_pass_confirm!" (
        echo %RED%Passwords do not match!%NC%
        pause
        goto ACCOUNT_MENU
    )
    
    bun run reset-admin-password.ts %reset_user% !new_pass!
    echo %GREEN%Password reset successfully!%NC%
) else (
    :: For operator/viewer accounts, use manage-webserver-accounts
    bun run manage-webserver-accounts.ts reset %reset_user%
)
pause
goto ACCOUNT_MENU

:DELETE_ACCOUNT
echo.
echo %CYAN%Delete Account%NC%
echo --------------
set /p del_user="Enter username to delete: "
set /p confirm="Are you sure you want to delete '%del_user%'? (y/N): "

if /i "%confirm%"=="y" (
    bun run manage-webserver-accounts.ts delete %del_user%
    echo %GREEN%Account deleted successfully!%NC%
) else (
    echo %YELLOW%Account deletion cancelled%NC%
)
pause
goto ACCOUNT_MENU

:RUN_CLI
echo %CYAN%Starting CLI...%NC%
bun run src/app.ts --cli
goto :eof

:START_DEV_SERVER
call :CHECK_DEV_SERVER
if %ERRORLEVEL% equ 0 (
    echo %YELLOW%Development server is already running!%NC%
    echo.
    echo 1) Restart server
    echo 2) Back to menu
    set /p restart_choice="Enter your choice (1-2): "
    
    if "!restart_choice!"=="1" (
        call :STOP_DEV_SERVER
    ) else (
        goto :eof
    )
)

echo %GREEN%Starting development server...%NC%
echo.
echo %CYAN%📝 Backend will run on port 3001 (WebSocket API)%NC%
echo %CYAN%🎨 Frontend will run on port 3000%NC%
echo %CYAN%🔥 Hot reload enabled for both services%NC%
echo.

:: Start the development server
bun run start-dev.ts
goto :eof

:START_PROD_SERVER
call :CHECK_DEV_SERVER
if %ERRORLEVEL% equ 0 (
    echo %YELLOW%Server is already running!%NC%
    pause
    goto :eof
)

echo %GREEN%Starting production server...%NC%
echo.

:: Check for admin account
bun run check-admin-password.ts >NUL 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%No admin account found!%NC%
    echo Please create an admin account first.
    pause
    goto :eof
)

bun run src/app.ts
goto :eof

:SHOW_STATUS
call :SHOW_HEADER
echo %BLUE%Server Status%NC%
echo =============
echo.

call :CHECK_DEV_SERVER
if %ERRORLEVEL% equ 0 (
    echo Server Status: %GREEN%RUNNING%NC%
    echo.
    echo Active processes:
    tasklist | findstr /I "bun.exe node.exe"
) else (
    echo Server Status: %RED%STOPPED%NC%
)

echo.
echo %BLUE%Database Status%NC%
echo ===============
if exist "prisma\database.db" (
    echo Database: %GREEN%EXISTS%NC%
    for %%A in ("prisma\database.db") do echo Size: %%~zA bytes
) else (
    echo Database: %RED%NOT FOUND%NC%
)

echo.
pause
goto :eof

:RUN_MIGRATIONS
echo %CYAN%Running database migrations...%NC%
call npx prisma migrate deploy
echo %GREEN%Migrations completed!%NC%
pause
goto :eof

:CHECK_DEPENDENCIES
where bun >NUL 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%Error: bun is not installed!%NC%
    echo Please install bun first: https://bun.sh
    exit /b 1
)

where npx >NUL 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%Error: npm/npx is not installed!%NC%
    echo Please install Node.js first: https://nodejs.org
    exit /b 1
)
goto :eof

:MAIN_MENU
call :SHOW_HEADER

call :CHECK_DEV_SERVER
if %ERRORLEVEL% equ 0 (
    echo Server Status: %GREEN%● RUNNING%NC%
) else (
    echo Server Status: %RED%● STOPPED%NC%
)

echo.
echo Main Menu:
echo ==========
echo.
echo 1) Start Development Server (with hot reload)
echo 2) Start Production Server
echo 3) Stop Server
echo 4) Server Status
echo 5) CLI - Manage Trading Accounts
echo 6) Manage System Accounts (Admin/Operators)
echo 7) Run Database Migrations
echo 8) Exit
echo.
set /p main_choice="Enter your choice (1-8): "

if "%main_choice%"=="1" (
    call :START_DEV_SERVER
    goto MAIN_MENU
)
if "%main_choice%"=="2" (
    call :START_PROD_SERVER
    goto MAIN_MENU
)
if "%main_choice%"=="3" (
    call :CHECK_DEV_SERVER
    if %ERRORLEVEL% equ 0 (
        call :STOP_DEV_SERVER
    ) else (
        echo %YELLOW%Server is not running%NC%
        pause
    )
    goto MAIN_MENU
)
if "%main_choice%"=="4" (
    call :SHOW_STATUS
    goto MAIN_MENU
)
if "%main_choice%"=="5" (
    call :CHECK_DEV_SERVER
    if %ERRORLEVEL% equ 0 (
        echo %YELLOW%Warning: Server is running. CLI may conflict with the running server.%NC%
        set /p continue_cli="Continue anyway? (y/N): "
        if /i "!continue_cli!"=="y" (
            call :RUN_CLI
        )
    ) else (
        call :RUN_CLI
    )
    goto MAIN_MENU
)
if "%main_choice%"=="6" (
    call :MANAGE_ACCOUNTS
    goto MAIN_MENU
)
if "%main_choice%"=="7" (
    call :RUN_MIGRATIONS
    goto MAIN_MENU
)
if "%main_choice%"=="8" (
    call :CHECK_DEV_SERVER
    if %ERRORLEVEL% equ 0 (
        echo %YELLOW%Server is still running.%NC%
        set /p stop_exit="Stop server and exit? (y/N): "
        if /i "!stop_exit!"=="y" (
            call :STOP_DEV_SERVER
        )
    )
    echo %GREEN%Goodbye!%NC%
    exit /b 0
)

echo %RED%Invalid choice!%NC%
pause
goto MAIN_MENU

:: Main execution
call :CHECK_DEPENDENCIES
if %ERRORLEVEL% neq 0 exit /b 1

:MAIN_LOOP
call :MAIN_MENU
goto MAIN_LOOP