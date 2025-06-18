# Gate.io API Module

Полнофункциональный TypeScript модуль для работы с Gate.io API с поддержкой множества аккаунтов, автоматическим управлением cookies и rate limiting.

## Возможности

- 🔐 **Множество аккаунтов** - управление несколькими аккаунтами одновременно
- 🍪 **Автоматическое управление cookies** - сохранение и загрузка сессий
- ⏱️ **Rate Limiting** - 240 запросов в минуту по умолчанию с автоматической очередью
- 🔄 **Автоматический повторный вход** - при истечении сессии
- 📊 **Полная типизация** - TypeScript интерфейсы для всех операций
- 🛡️ **Обработка ошибок** - специализированные классы ошибок

## Установка

```bash
npm install axios decimal.js form-data
```

## Быстрый старт

```typescript
import { GateAccountManager } from './gate';

// Создаем менеджер аккаунтов
const manager = new GateAccountManager({
  cookiesDir: './data/gate-cookies',
  rateLimiterOptions: {
    maxRequests: 240,    // 240 запросов
    windowMs: 60000      // в минуту
  },
  autoSaveCookies: true  // Автосохранение cookies
});

// Инициализация
await manager.initialize();

// Добавляем аккаунт
await manager.addAccount('user@example.com', 'password');

// Получаем баланс
const balance = await manager.getBalance('user@example.com', 'RUB');
console.log(`Баланс: ${balance.balance} RUB`);

// Получаем транзакции
const transactions = await manager.getAvailableTransactions('user@example.com');
```

## Основные классы

### GateAccountManager

Главный класс для управления аккаунтами.

```typescript
const manager = new GateAccountManager({
  cookiesDir?: string;              // Директория для cookies
  rateLimiterOptions?: {
    maxRequests?: number;           // Макс. запросов (240)
    windowMs?: number;              // Окно в мс (60000)
  };
  clientOptions?: {
    baseUrl?: string;               // URL API
    timeout?: number;               // Таймаут запроса
  };
  autoSaveCookies?: boolean;        // Автосохранение (true)
});
```

### Основные методы

```typescript
// Управление аккаунтами
await manager.addAccount(email, password, autoLogin?);
await manager.login(email);
await manager.removeAccount(email, deleteCookies?);
await manager.isAuthenticated(email);

// Операции
await manager.getBalance(email, currency?);
await manager.getAvailableTransactions(email);
await manager.getPendingTransactions(email);
await manager.searchTransactionById(email, transactionId);
await manager.setBalance(email, amount);
await manager.acceptTransaction(email, transactionId);
await manager.approveTransactionWithReceipt(email, transactionId, receiptPath);

// Утилиты
await manager.saveAllCookies();
manager.getAccounts();
manager.getRateLimiterStats();
manager.updateRateLimits(maxRequests?, windowMs?);
```

### GateClient

Низкоуровневый клиент для прямой работы с API.

```typescript
const client = manager.getClient(email);

// Или создаем напрямую
const rateLimiter = new RateLimiter({ maxRequests: 240 });
const client = new GateClient(rateLimiter, {
  baseUrl: 'https://panel.gate.cx/api/v1',
  timeout: 30000
});
```

### RateLimiter

Контролирует частоту запросов.

```typescript
const limiter = new RateLimiter({
  maxRequests: 240,    // Максимум запросов
  windowMs: 60000      // В окне времени (мс)
});

// Использование
await limiter.checkAndWait('endpoint');

// Статистика
const stats = limiter.getStats();
console.log(`${stats.currentRequests}/${stats.maxRequests}`);
```

## Работа с транзакциями

```typescript
// Получаем доступные транзакции (статус 4 или 5)
const available = await manager.getAvailableTransactions(email);

// Принимаем транзакцию
await manager.acceptTransaction(email, transactionId);

// Подтверждаем с чеком
await manager.approveTransactionWithReceipt(
  email,
  transactionId,
  './receipts/receipt.pdf'
);

// Или без чека
const client = manager.getClient(email);
await client.approveTransaction(transactionId);

// Отменяем
await client.cancelOrder(transactionId);
```

## Обработка ошибок

```typescript
try {
  await manager.getBalance(email);
} catch (error) {
  if (error instanceof SessionExpiredError) {
    // Сессия истекла - нужен повторный вход
    await manager.login(email);
  } else if (error instanceof CloudflareError) {
    // Блокировка Cloudflare
  } else if (error instanceof RateLimitError) {
    // Превышен лимит запросов
    console.log(`Повтор через ${error.retryAfter} сек`);
  } else if (error instanceof GateApiError) {
    // Общая ошибка API
    console.log(`Ошибка: ${error.message} (${error.code})`);
  }
}
```

## Автоматический повторный вход

```typescript
// Используйте withAutoRelogin для автоматической обработки истекших сессий
const result = await manager.withAutoRelogin(email, async (client) => {
  const balance = await client.getBalance('RUB');
  const transactions = await client.getAvailableTransactions();
  
  return { balance, transactionCount: transactions.length };
});
```

## Управление cookies

Cookies автоматически сохраняются после каждого запроса если `autoSaveCookies: true`.

```typescript
// Ручное управление
await manager.saveCookiesForAccount(email);
await manager.saveAllCookies();

// Прямая работа с cookies
const client = manager.getClient(email);
const cookies = client.getCookies();
await client.saveCookies('./custom-cookies.json');
await client.loadCookies('./custom-cookies.json');
```

## Статусы транзакций

```typescript
enum TransactionStatus {
  PENDING = 4,                    // Ожидает подтверждения
  IN_PROGRESS = 5,               // В процессе
  COMPLETED_WITH_RECEIPT = 7,    // Завершена с чеком
  HISTORY = 9                    // В истории
}
```

## Примеры

См. папку `examples/`:
- `basic-usage.ts` - базовое использование
- `multi-account.ts` - работа с несколькими аккаунтами  
- `advanced-usage.ts` - продвинутые примеры

## Лицензия

MIT