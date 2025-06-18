@echo off
echo Running Bybit Payment Methods Debug Test...
echo =======================================
echo.

REM Run the debug test
npx tsx test-bybit-payment-methods-debug.ts

echo.
echo =======================================
echo Test completed. Check the logs folder for detailed results.
echo.
pause