@echo off
echo.
echo Gmail Account Setup
echo ===================
echo.
echo This will set up your Gmail account for Itrader.
echo.
echo Instructions:
echo 1. A URL will be displayed below
echo 2. Copy and paste it into a NEW incognito/private browser window
echo 3. Sign in and authorize the app
echo 4. You'll be redirected to a page showing an authorization code
echo 5. Copy the code from the URL (between code= and &scope)
echo.
pause
echo.

bun run setup-gmail-manual.ts

pause