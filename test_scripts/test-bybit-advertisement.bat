@echo off
echo Testing Bybit Advertisement Parameters...
echo.

REM You can set your API credentials here or use existing .env file
REM set BYBIT_API_KEY=your-api-key
REM set BYBIT_API_SECRET=your-api-secret

npx ts-node test-bybit-advertisement.ts
pause