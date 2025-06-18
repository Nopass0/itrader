@echo off
echo Testing Bybit Payment Methods...
echo.

:: Run the test script
npx ts-node test-bybit-payment-methods.ts

echo.
echo Press any key to exit...
pause > nul