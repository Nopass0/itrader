# Настройка Gmail OAuth для iTrader

## Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите на https://console.cloud.google.com/
2. Создайте новый проект или выберите существующий
3. В боковом меню выберите "APIs & Services" > "Credentials"

## Шаг 2: Настройка OAuth consent screen

1. Перейдите в "OAuth consent screen"
2. Выберите "External" и нажмите "Create"
3. Заполните обязательные поля:
   - App name: iTrader
   - User support email: ваш email
   - Developer contact information: ваш email
4. Нажмите "Save and Continue"
5. На странице "Scopes" нажмите "Add or Remove Scopes"
6. Найдите и добавьте следующие scopes:
   - https://www.googleapis.com/auth/gmail.readonly
   - https://www.googleapis.com/auth/gmail.modify
7. Нажмите "Update" и затем "Save and Continue"
8. На странице "Test users" добавьте email адреса, которые будут использоваться для тестирования
9. Нажмите "Save and Continue"

## Шаг 3: Создание OAuth 2.0 Client ID

1. Вернитесь в "Credentials"
2. Нажмите "Create Credentials" > "OAuth client ID"
3. Выберите "Web application"
4. Название: iTrader Web
5. В разделе "Authorized redirect URIs" добавьте:
   - http://localhost:3000/panel/gmail-callback
   - http://localhost/panel/gmail-callback
   - Если у вас есть production URL, добавьте также: https://yourdomain.com/panel/gmail-callback
6. Нажмите "Create"

## Шаг 4: Скачивание credentials

1. После создания OAuth client ID, нажмите на кнопку скачивания (Download JSON)
2. Сохраните файл как `gmail-credentials.json`
3. Поместите файл в папку `data/` вашего проекта:
   ```
   itrader_project/
   └── data/
       └── gmail-credentials.json
   ```

## Шаг 5: Проверка структуры файла

Убедитесь, что файл `gmail-credentials.json` имеет следующую структуру:

```json
{
  "web": {
    "client_id": "ваш-client-id.apps.googleusercontent.com",
    "project_id": "ваш-project-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "ваш-client-secret",
    "redirect_uris": [
      "http://localhost:3000/panel/gmail-callback",
      "http://localhost/panel/gmail-callback"
    ]
  }
}
```

## Шаг 6: Обновление переменных окружения

В файле `.env` добавьте (если еще нет):

```env
FRONTEND_URL=http://localhost:3000
```

Для production используйте ваш реальный домен:
```env
FRONTEND_URL=https://yourdomain.com
```

## Использование

1. Запустите проект
2. Перейдите на страницу "Аккаунты" в панели управления
3. Нажмите "Добавить аккаунт"
4. Выберите вкладку "Gmail"
5. Нажмите "Авторизоваться через Google"
6. Войдите в свой Gmail аккаунт
7. Разрешите доступ приложению
8. Вы будете автоматически перенаправлены обратно

## Возможные проблемы

### Ошибка 400: redirect_uri_mismatch

Эта ошибка означает, что URL для перенаправления не совпадает с настроенным в Google Console.

**Решение:**
1. Проверьте, что в Google Console добавлены все необходимые redirect URIs
2. Убедитесь, что URL в точности совпадает (включая протокол http/https и порт)
3. Подождите несколько минут после изменения настроек в Google Console

### Invalid grant

Эта ошибка возникает, когда код авторизации недействителен.

**Причины и решения:**
1. **Код устарел** - используйте код в течение 5 минут после получения
2. **Код уже использован** - каждый код можно использовать только один раз
3. **Неправильный код** - убедитесь, что копируете правильный код из URL
4. **Истекший сеанс** - начните процесс авторизации заново

### No refresh token received

Эта ошибка возникает, если приложение уже было авторизовано ранее.

**Решение:**
1. Перейдите на https://myaccount.google.com/permissions
2. Найдите ваше приложение "iTrader"
3. Отзовите доступ
4. Попробуйте авторизоваться заново

### Приложение не проверено Google

Если вы видите предупреждение о том, что приложение не проверено:

1. Нажмите "Advanced" (Дополнительно)
2. Нажмите "Go to iTrader (unsafe)" (Перейти к iTrader (небезопасно))
3. Это нормально для тестового приложения

Для production рекомендуется пройти процесс верификации приложения в Google.