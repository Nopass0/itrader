# Создание нового OAuth Client для решения проблемы redirect_uri_mismatch

## Проблема
Текущий OAuth клиент неправильно настроен, что вызывает ошибку redirect_uri_mismatch.

## Решение - Создайте НОВЫЙ OAuth Client

### Шаг 1: Удалите старый клиент (опционально)
1. Перейдите на https://console.cloud.google.com/apis/credentials
2. Найдите старый OAuth 2.0 Client ID (698858443063...)
3. Удалите его или оставьте для истории

### Шаг 2: Создайте новый OAuth 2.0 Client ID
1. Нажмите "+ CREATE CREDENTIALS" → "OAuth client ID"
2. Application type: выберите **"Web application"** (НЕ Desktop app!)
3. Name: "iTrader Gmail Access Web"
4. В разделе "Authorized redirect URIs" добавьте ВСЕ эти URI:
   ```
   http://localhost
   http://localhost/
   http://localhost:3000
   http://localhost:8080
   http://127.0.0.1
   http://127.0.0.1:3000
   http://127.0.0.1:8080
   ```
5. Нажмите "CREATE"

### Шаг 3: Скачайте новые credentials
1. После создания появится окно с Client ID и Client Secret
2. Нажмите "DOWNLOAD JSON"
3. Сохраните файл

### Шаг 4: Обновите credentials в проекте
Замените содержимое файла `data/gmail-credentials.json` на скачанный JSON.

## Альтернативный вариант - Используйте тестовое приложение Google

Если создание нового клиента не помогает, используйте готовый тестовый клиент от Google.