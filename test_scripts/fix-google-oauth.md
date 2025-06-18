# Решение проблемы с бесконечной загрузкой Google OAuth

## Проблема
После нажатия "Continue" на странице авторизации Google, страница бесконечно загружается.

## Причина
Google не может выполнить redirect на указанный URI, потому что:
1. Redirect URI не добавлен в Google Cloud Console
2. Или есть несоответствие между URI в запросе и в консоли

## Решение

### Шаг 1: Проверьте текущие настройки
1. Перейдите на https://console.cloud.google.com/
2. Выберите ваш проект (orbital-avatar-442511-c6)
3. Перейдите в "APIs & Services" → "Credentials"
4. Найдите ваш OAuth 2.0 Client ID (начинается с 698858443063...)
5. Нажмите на него для редактирования

### Шаг 2: Настройте Authorized redirect URIs
В разделе "Authorized redirect URIs" должны быть ТОЧНО эти URI:
```
http://localhost
http://localhost/
http://localhost:8080
http://localhost:3000
```

**ВАЖНО**: Добавьте ВСЕ эти варианты, включая вариант с и без слеша в конце!

### Шаг 3: Сохраните и подождите
1. Нажмите "SAVE"
2. Подождите 5-10 минут для применения изменений

### Шаг 4: Альтернативный метод - создайте новый OAuth Client
Если проблема остается:

1. В Google Cloud Console создайте НОВЫЙ OAuth 2.0 Client ID
2. Тип приложения: "Web application" 
3. Name: "iTrader Gmail Access"
4. Authorized redirect URIs:
   - http://localhost
   - http://localhost/
5. Скачайте новый credentials.json
6. Замените файл в data/gmail-credentials.json

### Шаг 5: Используйте тестовый скрипт
После настройки используйте упрощенный тестовый скрипт для проверки.