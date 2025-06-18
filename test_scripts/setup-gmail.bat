@echo off
echo.
echo Gmail Setup Helper
echo ==================
echo.
echo This script will help you set up Gmail integration.
echo.

REM Check if data directory exists
if not exist "data" (
    echo Creating data directory...
    mkdir data
)

REM Check if credentials file exists
if exist "data\gmail-credentials.json" (
    echo ✓ Gmail credentials file found!
    goto :SETUP
) else (
    echo ✗ Gmail credentials file NOT found!
    echo.
    echo Please follow these steps:
    echo.
    echo 1. Go to: https://console.cloud.google.com/
    echo 2. Create new project or select existing
    echo 3. Enable Gmail API
    echo 4. Create OAuth2 credentials (Desktop app)
    echo 5. Download the JSON file
    echo 6. Save it as: %CD%\data\gmail-credentials.json
    echo.
    echo After completing these steps, run this script again.
    echo.
    pause
    exit
)

:SETUP
echo.
echo Starting Gmail setup (Manual Code Entry)...
echo.
echo This will use manual code entry for reliability.
echo You'll need to:
echo 1. Open a URL in your browser
echo 2. Authorize the application
echo 3. Copy the authorization code
echo 4. Paste it here
echo.
bun run setup-gmail.ts
pause