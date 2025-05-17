# AI Trader API Документация

В данном документе подробно описаны все API-запросы для интеграции с платформами Gate.cx и Bybit, включая процессы аутентификации, получения данных и форматы ответов.

## Содержание
- [Gate.cx API](#gatecx-api)
  - [Аутентификация Gate.cx](#аутентификация-gatecx)
  - [Получение транзакций Gate.cx](#получение-транзакций-gatecx)
  - [Получение SMS-сообщений Gate.cx](#получение-sms-сообщений-gatecx)
  - [Получение Push-уведомлений Gate.cx](#получение-push-уведомлений-gatecx)
- [Bybit API](#bybit-api)
  - [Аутентификация Bybit](#аутентификация-bybit)
  - [Получение транзакций Bybit](#получение-транзакций-bybit)
- [AI Trader API](#ai-trader-api)
  - [Аутентификация AI Trader API](#аутентификация-ai-trader-api)
  - [Эндпоинты AI Trader API](#эндпоинты-ai-trader-api)

---

## Gate.cx API

### Аутентификация Gate.cx

Gate.cx использует cookie-based аутентификацию через API endpoint.

**URL**: `https://panel.gate.cx/api/v1/auth/basic/login`

**Метод**: `POST`

**Заголовки запроса**:
```
Content-Type: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36
Referer: https://panel.gate.cx/
Accept: application/json, text/plain, */*
Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
```

**Тело запроса**:
```json
{
  "login": "user@example.com",
  "password": "your_password"
}
```

**Пример ответа успешной аутентификации**:
```json
{
  "success": true,
  "response": {
    "user": {
      "id": 12345,
      "name": "User Name",
      "email": "user@example.com",
      "role": "trader",
      "created_at": "2023-01-01T00:00:00.000000Z",
      "updated_at": "2023-01-01T00:00:00.000000Z"
    },
    "access_token": "eyJhbGciOiJIUzI1..."
  }
}
```

**Обработка ответа**:
1. Проверить `success` поле (должно быть `true`)
2. Сохранить cookie из заголовка ответа `Set-Cookie` для последующих запросов
3. Сохранить данные пользователя из поля `response.user`


### Получение информации о пользователе Gate.cx

**URL**: `https://panel.gate.cx/api/v1/auth/me`

**Метод**: `GET`

**Заголовки запроса**:
```
Content-Type: application/json
Referer: https://panel.gate.cx/requests?page=1
Cookie: <cookies_from_authentication>
```

**Пример ответа**:
```json
{
  "success": true,
  "response": {
    "user": {
      "id": 12345,
      "name": "User Name",
      "email": "user@example.com",
      "role": "trader",
      "created_at": "2023-01-01T00:00:00.000000Z",
      "updated_at": "2023-01-01T00:00:00.000000Z"
    }
  }
}
```

### Получение транзакций Gate.cx

**URL**: `https://panel.gate.cx/api/v1/payments/payouts?page=1`

**Метод**: `GET`

**Заголовки запроса**:
```
Content-Type: application/json
Referer: https://panel.gate.cx/requests?page=1
Cookie: <cookies_from_authentication>
Accept: application/json, text/plain, */*
Accept-Language: ru,en;q=0.9
```

**Параметры запроса**:
- `page`: Номер страницы (начиная с 1)
- `filters[status][]`: Фильтр по статусу (можно указать несколько)
- `search[id]`: Поиск по ID транзакции
- `search[wallet]`: Поиск по кошельку

**Пример запроса с фильтрами**:
```
https://panel.gate.cx/api/v1/payments/payouts?page=1&filters[status][]=7&search[wallet]=1234567890
```

**Пример ответа**:
```json
{
  "success": true,
  "response": {
    "payouts": {
      "current_page": 1,
      "data": [
        {
          "id": 123456,
          "status": 7,
          "wallet": "1234567890",
          "method": {
            "id": 1,
            "label": "Bank Transfer"
          },
          "amount": {
            "trader": {
              "643": 1000.00
            }
          },
          "total": {
            "trader": {
              "643": 1000.00
            }
          },
          "meta": {
            "bank": "Sberbank",
            "card_number": "1234 **** **** 5678"
          },
          "created_at": "2023-01-01T12:00:00.000000Z",
          "updated_at": "2023-01-01T12:05:00.000000Z",
          "tooltip": "Transaction completed successfully"
        }
      ],
      "first_page_url": "https://panel.gate.cx/api/v1/payments/payouts?page=1",
      "from": 1,
      "last_page": 10,
      "last_page_url": "https://panel.gate.cx/api/v1/payments/payouts?page=10",
      "next_page_url": "https://panel.gate.cx/api/v1/payments/payouts?page=2",
      "path": "https://panel.gate.cx/api/v1/payments/payouts",
      "per_page": 10,
      "prev_page_url": null,
      "to": 10,
      "total": 100
    }
  }
}
```

**Статусы транзакций**:
1. Pending (Ожидает)
2. In Progress (В процессе)
3. Partially Completed (Частично завершена)
4. Processing (Обрабатывается)
5. Awaiting Confirmation (Ожидает подтверждения)
6. Cancelled (Отменена)
7. Completed (Завершена)
8. Rejected (Отклонена)

**Коды валют**:
- `643`: RUB (Российский рубль)
- `000001`: USDT (Tether USD)

### Получение SMS-сообщений Gate.cx

**URL**: `https://panel.gate.cx/api/v1/devices/sms?page=1`

**Метод**: `GET`

**Заголовки запроса**:
```
Content-Type: application/json
Referer: https://panel.gate.cx/requests
Cookie: <cookies_from_authentication>
```

**Параметры запроса**:
- `page`: Номер страницы (начиная с 1)
- `status`: Фильтр по статусу (опционально)

**Пример ответа**:
```json
{
  "success": true,
  "response": {
    "sms": {
      "current_page": 1,
      "data": [
        {
          "id": 123456,
          "from": "+79123456789",
          "text": "Перевод 5000р. Баланс: 10000р.",
          "status": 1,
          "received_at": "2023-01-01T12:00:00.000000Z",
          "created_at": "2023-01-01T12:00:05.000000Z",
          "device": {
            "id": 789,
            "name": "Samsung Galaxy S20"
          },
          "parsed": {
            "amount": 5000,
            "currency": "RUB",
            "balance": 10000
          }
        }
      ],
      "first_page_url": "https://panel.gate.cx/api/v1/devices/sms?page=1",
      "from": 1,
      "last_page": 5,
      "last_page_url": "https://panel.gate.cx/api/v1/devices/sms?page=5",
      "next_page_url": "https://panel.gate.cx/api/v1/devices/sms?page=2",
      "path": "https://panel.gate.cx/api/v1/devices/sms",
      "per_page": 10,
      "prev_page_url": null,
      "to": 10,
      "total": 50
    }
  }
}
```

### Получение Push-уведомлений Gate.cx

**URL**: `https://panel.gate.cx/api/v1/devices/pushes?page=1`

**Метод**: `GET`

**Заголовки запроса**:
```
Content-Type: application/json
Referer: https://panel.gate.cx/requests
Cookie: <cookies_from_authentication>
```

**Параметры запроса**:
- `page`: Номер страницы (начиная с 1)
- `status`: Фильтр по статусу (опционально)

**Пример ответа**:
```json
{
  "success": true,
  "response": {
    "pushes": {
      "current_page": 1,
      "data": [
        {
          "id": 123456,
          "package_name": "ru.sberbankmobile",
          "title": "Перевод",
          "text": "Перевод на карту 5000р",
          "status": 1,
          "received_at": "2023-01-01T12:00:00.000000Z",
          "created_at": "2023-01-01T12:00:05.000000Z",
          "device": {
            "id": 789,
            "name": "Samsung Galaxy S20"
          },
          "parsed": {
            "amount": 5000,
            "currency": "RUB"
          }
        }
      ],
      "first_page_url": "https://panel.gate.cx/api/v1/devices/pushes?page=1",
      "from": 1,
      "last_page": 5,
      "last_page_url": "https://panel.gate.cx/api/v1/devices/pushes?page=5",
      "next_page_url": "https://panel.gate.cx/api/v1/devices/pushes?page=2",
      "path": "https://panel.gate.cx/api/v1/devices/pushes",
      "per_page": 10,
      "prev_page_url": null,
      "to": 10,
      "total": 50
    }
  }
}
```

---

## Bybit API

### Аутентификация Bybit

Bybit использует API-ключи и подписи для аутентификации запросов.

**Базовый URL**:
- Основная сеть: `https://api.bybit.com`
- Тестовая сеть: `https://api-testnet.bybit.com`

**Генерация подписи**:
1. Сформировать строку для подписи: `timestamp + api_key + recv_window + query_string`
2. Создать HMAC-SHA256 подпись с API Secret как ключом

**Заголовки запроса**:
```
X-BAPI-API-KEY: your_api_key
X-BAPI-TIMESTAMP: 1677771334027
X-BAPI-RECV-WINDOW: 5000
X-BAPI-SIGN: calculated_signature
```

### Верификация API-ключа Bybit

**URL**: `/v5/account/wallet-balance`

**Метод**: `GET`

**Параметры запроса**:
- `accountType`: Тип аккаунта (например, "UNIFIED")
- `coin`: Валюта (например, "USDT")

**Полный URL с параметрами**: `https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED&coin=USDT`

### Получение транзакций Bybit

#### Получение истории ордеров

**URL**: `/v5/order/history`

**Метод**: `GET`

**Параметры запроса**:
- `category`: Категория (например, "spot" или "linear")
- `orderId`: ID ордера (опционально)
- `symbol`: Символ торговой пары (опционально)
- `limit`: Количество записей (опционально, по умолчанию 20, максимум 50)
- `cursor`: Курсор для пагинации (опционально)

**Пример запроса**: `https://api.bybit.com/v5/order/history?category=spot&limit=50`

**Пример ответа**:
```json
{
  "retCode": 0,
  "retMsg": "OK",
  "result": {
    "list": [
      {
        "orderId": "1271059595344191488",
        "orderLinkId": "1621845393",
        "symbol": "BTCUSDT",
        "side": "Buy",
        "orderType": "Market",
        "price": "38000",
        "qty": "0.001",
        "timeInForce": "IOC",
        "orderStatus": "Filled",
        "execType": "Trade",
        "lastExecQty": "0.001",
        "execQty": "0.001",
        "execFee": "0.00000075",
        "execPrice": "38000",
        "leavesQty": "0",
        "cumExecQty": "0.001",
        "cumExecValue": "38",
        "cumExecFee": "0.00000075",
        "createdTime": "1676360000000",
        "updatedTime": "1676360000500"
      }
    ],
    "nextPageCursor": "page_cursor_string",
    "category": "spot"
  }
}
```

#### Получение истории депозитов

**URL**: `/v5/asset/deposit/query-record`

**Метод**: `GET`

**Параметры запроса**:
- `coin`: Валюта (опционально)
- `startTime`: Время начала в миллисекундах (опционально)
- `endTime`: Время окончания в миллисекундах (опционально)
- `limit`: Количество записей (опционально, по умолчанию 20, максимум 50)
- `cursor`: Курсор для пагинации (опционально)

**Пример запроса**: `https://api.bybit.com/v5/asset/deposit/query-record?limit=50`

#### Получение истории выводов

**URL**: `/v5/asset/withdraw/query-record`

**Метод**: `GET`

**Параметры запроса**:
- `coin`: Валюта (опционально)
- `startTime`: Время начала в миллисекундах (опционально)
- `endTime`: Время окончания в миллисекундах (опционально)
- `limit`: Количество записей (опционально, по умолчанию 20, максимум 50)
- `cursor`: Курсор для пагинации (опционально)

**Пример запроса**: `https://api.bybit.com/v5/asset/withdraw/query-record?limit=50`

**Форматы данных в ответах Bybit**:
1. Для ордеров - `list` в объекте `result`
2. Для депозитов/выводов - `rows` в объекте `result`

**Поля для идентификации транзакций**:
- `id` или `orderId` для ордеров
- `txID` для депозитов/выводов

**Трансформация статусов Bybit в единый формат**:
- `COMPLETED`, `DONE`, `SUCCESS` -> 7 (Completed)
- `PENDING` -> 1 (Pending)
- `PROCESSING` -> 2 (In Progress)
- `FAILED`, `CANCELED` -> 3 (Partially Completed/Cancelled)

---

## AI Trader API

### Аутентификация AI Trader API

AI Trader API использует JWT токены для аутентификации.

**Получение токена**:
- Токен генерируется при запуске приложения
- Токен печатается в консоль и может быть скопирован в буфер обмена

**Использование токена**:
1. В заголовке `Authorization`: `Bearer YOUR_TOKEN`
2. В заголовке `X-API-Token`: `YOUR_TOKEN`
3. В URL как параметр: `?token=YOUR_TOKEN`

### Эндпоинты AI Trader API

#### Получение информации о Gate.cx аккаунтах

**URL**: `/gate/accounts`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)

**Пример запроса**: `http://localhost:3000/gate/accounts?token=YOUR_TOKEN`

**Пример ответа**:
```json
{
  "success": true,
  "data": [
    {
      "id": 12345,
      "name": "User Name",
      "email": "user@example.com",
      "role": "trader",
      "created_at": "2023-01-01T00:00:00.000000Z",
      "updated_at": "2023-01-01T00:00:00.000000Z"
    }
  ],
  "error": null
}
```

#### Получение информации о конкретном Gate.cx аккаунте

**URL**: `/gate/account/:account_id`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)

**Пример запроса**: `http://localhost:3000/gate/account/12345?token=YOUR_TOKEN`

#### Получение транзакций Gate.cx

**URL**: `/gate/transactions`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)
- `page`: Номер страницы (по умолчанию 1)
- `limit`: Количество записей на странице (по умолчанию 10)
- `status`: Статусы через запятую (например, "1,2,7")
- `transaction_id`: ID транзакции для фильтрации
- `wallet`: Номер кошелька для фильтрации

**Пример запроса**: `http://localhost:3000/gate/transactions?page=1&limit=20&status=7&wallet=1234567890`

**Пример ответа с пагинацией**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 123456,
        "status": 7,
        "amount": {
          "trader": {
            "643": 1000.00
          }
        },
        "created_at": "2023-01-01T12:00:00.000000Z",
        "updated_at": "2023-01-01T12:05:00.000000Z",
        "additional_fields": {
          "wallet": "1234567890",
          "method": {
            "id": 1,
            "label": "Bank Transfer"
          }
        }
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "has_next": true
    }
  },
  "error": null
}
```

#### Получение транзакций конкретного Gate.cx аккаунта

**URL**: `/gate/account/:account_id/transactions`

**Метод**: `GET`

**Параметры запроса**: те же, что и для `/gate/transactions`

**Пример запроса**: `http://localhost:3000/gate/account/12345/transactions?page=1&limit=20`

#### Получение SMS-сообщений Gate.cx

**URL**: `/gate/sms`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)
- `page`: Номер страницы (по умолчанию 1)
- `limit`: Количество записей на странице (по умолчанию 10)
- `status`: Статус для фильтрации (опционально)

**Пример запроса**: `http://localhost:3000/gate/sms?page=1&limit=20`

#### Получение SMS-сообщений конкретного Gate.cx аккаунта

**URL**: `/gate/account/:account_id/sms`

**Метод**: `GET`

**Параметры запроса**: те же, что и для `/gate/sms`

**Пример запроса**: `http://localhost:3000/gate/account/12345/sms?page=1&limit=20`

#### Получение Push-уведомлений Gate.cx

**URL**: `/gate/push`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)
- `page`: Номер страницы (по умолчанию 1)
- `limit`: Количество записей на странице (по умолчанию 10)
- `status`: Статус для фильтрации (опционально)

**Пример запроса**: `http://localhost:3000/gate/push?page=1&limit=20`

#### Получение Push-уведомлений конкретного Gate.cx аккаунта

**URL**: `/gate/account/:account_id/push`

**Метод**: `GET`

**Параметры запроса**: те же, что и для `/gate/push`

**Пример запроса**: `http://localhost:3000/gate/account/12345/push?page=1&limit=20`

#### Получение информации о Bybit аккаунтах

**URL**: `/bybit/accounts`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)

**Пример запроса**: `http://localhost:3000/bybit/accounts?token=YOUR_TOKEN`

#### Получение информации о конкретном Bybit аккаунте

**URL**: `/bybit/account/:account_id`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)

**Пример запроса**: `http://localhost:3000/bybit/account/12345?token=YOUR_TOKEN`

#### Получение транзакций Bybit

**URL**: `/bybit/transactions`

**Метод**: `GET`

**Параметры запроса**:
- `token`: API токен (опционально, если не указан в заголовке)
- `page`: Номер страницы (по умолчанию 1)
- `limit`: Количество записей на странице (по умолчанию 10)
- `status`: Статусы через запятую (например, "1,2,7")
- `transaction_id`: ID транзакции для фильтрации
- `wallet`: Номер кошелька для фильтрации

**Пример запроса**: `http://localhost:3000/bybit/transactions?page=1&limit=20`

#### Получение транзакций конкретного Bybit аккаунта

**URL**: `/bybit/account/:account_id/transactions`

**Метод**: `GET`

**Параметры запроса**: те же, что и для `/bybit/transactions`

**Пример запроса**: `http://localhost:3000/bybit/account/12345/transactions?page=1&limit=20`

---

## Общие статусы кодов и сообщения об ошибках

### HTTP-статусы

- `200 OK`: Запрос выполнен успешно
- `400 Bad Request`: Неверный запрос
- `401 Unauthorized`: Не авторизован (неверный токен)
- `403 Forbidden`: Доступ запрещен
- `404 Not Found`: Ресурс не найден
- `500 Internal Server Error`: Внутренняя ошибка сервера

### Коды ошибок в ответах

```json
{
  "success": false,
  "data": null,
  "error": "Error message description"
}
```

## Структура объекта транзакции

```json
{
  "id": 123456,
  "status": 7,
  "amount": {
    "trader": {
      "643": 1000.00
    }
  },
  "created_at": "2023-01-01T12:00:00.000000Z",
  "updated_at": "2023-01-01T12:05:00.000000Z",
  "additional_fields": {
    "wallet": "1234567890",
    "method": {
      "id": 1,
      "label": "Bank Transfer"
    },
    "total": {
      "trader": {
        "643": 1000.00
      }
    },
    "meta": {
      "bank": "Sberbank",
      "card_number": "1234 **** **** 5678"
    }
  }
}
```

## Структура объекта SMS-сообщения

```json
{
  "id": 123456,
  "from": "+79123456789",
  "text": "Перевод 5000р. Баланс: 10000р.",
  "status": 1,
  "received_at": "2023-01-01T12:00:00.000000Z",
  "created_at": "2023-01-01T12:00:05.000000Z",
  "device_id": 789,
  "device_name": "Samsung Galaxy S20",
  "additional_fields": {
    "parsed": {
      "amount": 5000,
      "currency": "RUB",
      "balance": 10000
    }
  }
}
```

## Структура объекта Push-уведомления

```json
{
  "id": 123456,
  "package_name": "ru.sberbankmobile",
  "title": "Перевод",
  "text": "Перевод на карту 5000р",
  "status": 1,
  "received_at": "2023-01-01T12:00:00.000000Z",
  "created_at": "2023-01-01T12:00:05.000000Z",
  "device_id": 789,
  "device_name": "Samsung Galaxy S20",
  "has_parsed_data": true,
  "additional_fields": {
    "parsed": {
      "amount": 5000,
      "currency": "RUB"
    }
  }
}
```
