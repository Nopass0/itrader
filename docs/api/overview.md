# API Overview

AI Trader предоставляет REST API для взаимодействия с платформами Gate.cx и Bybit.

## Базовый URL

- **Разработка**: `http://localhost:3000`
- **Продакшн**: `https://api.example.com` (замените на ваш домен)

## Формат ответов

Все ответы API возвращаются в следующем формате:

```json
{
  "success": true | false,
  "data": <данные или null>,
  "error": <сообщение об ошибке или null>
}
```

### Успешный ответ

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Example"
  },
  "error": null
}
```

### Ответ с ошибкой

```json
{
  "success": false,
  "data": null,
  "error": "Unauthorized: Authentication required"
}
```

## Пагинация

Эндпоинты, возвращающие списки данных, используют пагинацию:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Item 1"
      },
      {
        "id": 2,
        "name": "Item 2"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 42,
      "has_next": true
    }
  },
  "error": null
}
```

## Аутентификация

API использует JWT токены для аутентификации. Вы можете предоставить токен одним из следующих способов:

1. **Authorization header**:
   ```
   Authorization: Bearer <token>
   ```

2. **X-API-Token header**:
   ```
   X-API-Token: <token>
   ```

3. **Query parameter**:
   ```
   ?token=<token>
   ```

### Получение токена

```
POST /auth/login

{
  "username": "user",
  "password": "password"
}
```

Ответ:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1...",
    "user": {
      "id": 1,
      "username": "user"
    }
  },
  "error": null
}
```

## Статус-коды HTTP

- `200 OK` - Запрос выполнен успешно
- `400 Bad Request` - Неверный запрос
- `401 Unauthorized` - Не авторизован (неверный токен)
- `403 Forbidden` - Доступ запрещен
- `404 Not Found` - Ресурс не найден
- `500 Internal Server Error` - Внутренняя ошибка сервера

## API Группы

API разделен на следующие группы:

1. [Аутентификация](/docs/api/auth.md)
2. [Gate.cx API](/docs/api/gate.md)
3. [Bybit API](/docs/api/bybit.md)
4. [Администрирование](/docs/api/admin.md)

## Примеры запросов

### cURL

```bash
# Авторизация
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "password"}'

# Запрос с токеном
curl http://localhost:3000/gate/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript (axios)

```javascript
import axios from 'axios';

// Авторизация
const login = async (username, password) => {
  try {
    const response = await axios.post('http://localhost:3000/auth/login', {
      username,
      password
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

// Запрос с токеном
const getTransactions = async (token) => {
  try {
    const response = await axios.get('http://localhost:3000/gate/transactions', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```