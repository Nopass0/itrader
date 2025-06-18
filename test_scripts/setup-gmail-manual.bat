@echo off
echo.
echo Gmail Manual Setup
echo ==================
echo.
echo Инструкции:
echo 1. Откройте ссылку в браузере (лучше в режиме инкогнито)
echo 2. Войдите в Google аккаунт и разрешите доступ
echo 3. Скопируйте код из адресной строки
echo 4. Вставьте код когда попросят
echo.
pause

bun run src/setup-gmail-manual.ts

pause