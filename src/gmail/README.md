# Gmail API Module

Модуль для работы с Gmail API с поддержкой OAuth2 авторизации, управления несколькими аккаунтами и расширенными возможностями поиска и обработки писем.

## Возможности

- 🔐 **OAuth2 авторизация** - полная поддержка OAuth2 flow
- 👥 **Множество аккаунтов** - управление несколькими Gmail аккаунтами
- 💾 **Автосохранение токенов** - токены сохраняются и загружаются автоматически
- 🔍 **Расширенный поиск** - фильтры по дате, отправителю, вложениям
- 📎 **Работа с вложениями** - скачивание PDF и других файлов
- 💳 **Парсинг платежей** - извлечение информации о платежах из писем
- 📄 **Пагинация** - поддержка постраничной загрузки

## Установка

```bash
npm install googleapis
```

## Подготовка

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com/)
2. Включите Gmail API
3. Создайте OAuth2 credentials (Desktop application)
4. Скачайте `credentials.json`

## Быстрый старт

```typescript
import { GmailManager } from './gmail';

// Создаем менеджер из файла credentials
const manager = await GmailManager.fromCredentialsFile(
  './credentials.json',
  {
    tokensDir: './data/gmail-tokens',
    autoSaveTokens: true
  }
);

await manager.initialize();

// Добавляем аккаунт интерактивно
const email = await manager.addAccountInteractive();

// Получаем письма
const emails = await manager.getEmails(email, {
  maxResults: 10
});

emails.messages.forEach(msg => {
  console.log(`От: ${msg.from}`);
  console.log(`Тема: ${msg.subject}`);
  console.log(`Дата: ${msg.date}`);
});
```

## Основные классы

### GmailManager

Главный класс для управления аккаунтами.

```typescript
const manager = new GmailManager({
  credentials: credentialsJson,  // Объект credentials или путь к файлу
  tokensDir: './tokens',         // Директория для токенов
  autoSaveTokens: true,          // Автосохранение токенов
  clientOptions: {
    scopes: [                    // OAuth2 scopes
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ]
  }
});
```

### Основные методы

#### Управление аккаунтами

```typescript
// Добавить аккаунт интерактивно
const email = await manager.addAccountInteractive();

// Добавить аккаунт с токенами
await manager.addAccountWithTokens(tokens);

// Добавить через код авторизации
const authUrl = manager.getAuthUrl();
// Пользователь переходит по URL и получает код
await manager.addAccountWithAuthCode(code);

// Загрузить сохраненные аккаунты
await manager.loadAllAccounts();

// Получить список аккаунтов
const accounts = manager.getAccounts();
```

#### Работа с письмами

```typescript
// Получить письма с фильтрами
const emails = await manager.getEmails(email, {
  from: 'noreply@sberbank.ru',
  after: '2024/1/1',
  hasAttachment: true,
  maxResults: 50
});

// Получить письма за период
const recentEmails = await manager.getEmailsByDateRange(
  email,
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

// Получить письма с PDF
const pdfEmails = await manager.getEmailsWithPdfAttachments(email);

// Получить письма от отправителя
const senderEmails = await manager.getEmailsFromSender(
  email,
  'support@tinkoff.ru'
);
```

#### Работа с вложениями

```typescript
// Скачать вложение
const attachment = await manager.downloadAttachment(
  email,
  messageId,
  attachmentId
);

// Скачать все PDF из письма
const pdfs = await manager.downloadPdfAttachments(email, messageId);

// Сохранить PDF в файл
await manager.downloadPdfToFile(
  email,
  messageId,
  attachmentId,
  './receipts/receipt.pdf'
);
```

#### Управление письмами

```typescript
// Пометить как прочитанное
await manager.markAsRead(email, messageId);

// Получить клиент для прямой работы
const client = manager.getClient(email);
await client.markAsUnread(messageId);
await client.addStar(messageId);
```

### EmailParser

Утилита для парсинга платежных писем.

```typescript
import { EmailParser } from './gmail';

const parser = new EmailParser();

// Проверить, является ли письмо платежным
if (parser.isPaymentEmail(message)) {
  // Извлечь информацию о платеже
  const receipt = parser.parseReceipt(message);
  
  console.log(`Сумма: ${receipt.amount}`);
  console.log(`Отправитель: ${receipt.sender}`);
  console.log(`ID транзакции: ${receipt.transactionId}`);
}

// Извлечь все платежные письма
const paymentEmails = parser.extractPaymentEmails(messages);

// Сгруппировать по отправителям
const grouped = parser.groupBySender(messages);
```

## Фильтры поиска

```typescript
interface EmailFilter {
  // Основные фильтры
  from?: string;              // Отправитель
  to?: string;                // Получатель
  subject?: string;           // Тема
  query?: string;             // Произвольный запрос
  
  // Фильтры по дате
  after?: Date | string;      // После даты
  before?: Date | string;     // До даты
  
  // Дополнительные фильтры
  hasAttachment?: boolean;    // Есть вложения
  attachmentType?: 'pdf';     // Тип вложения
  isUnread?: boolean;         // Непрочитанные
  isImportant?: boolean;      // Важные
  isStarred?: boolean;        // Помеченные
  
  // Пагинация
  maxResults?: number;        // Макс. результатов
  pageToken?: string;         // Токен страницы
}
```

## Примеры запросов

```typescript
// Сложный поиск
const results = await manager.getEmails(email, {
  query: 'from:(sberbank OR tinkoff) has:attachment',
  after: '2024/1/1',
  maxResults: 100
});

// Поиск с пагинацией
let pageToken;
do {
  const result = await manager.getEmails(email, {
    maxResults: 50,
    pageToken
  });
  
  // Обработка результатов
  processEmails(result.messages);
  
  pageToken = result.nextPageToken;
} while (pageToken);
```

## Обработка ошибок

```typescript
import { GmailAuthError, GmailQuotaError } from './gmail';

try {
  await manager.getEmails(email);
} catch (error) {
  if (error instanceof GmailAuthError) {
    // Требуется повторная авторизация
    await manager.addAccountInteractive();
  } else if (error instanceof GmailQuotaError) {
    // Превышена квота API
    console.log(`Повтор через ${error.retryAfter} секунд`);
  }
}
```

## OAuth2 Flow

### 1. Интерактивная авторизация (консоль)

```typescript
const email = await manager.addAccountInteractive();
// Откроется браузер, пользователь авторизуется
```

### 2. Веб-авторизация

```typescript
// Получить URL для авторизации
const authUrl = manager.getAuthUrl('my-state');

// Перенаправить пользователя на authUrl
// После авторизации получить код

// Добавить аккаунт с кодом
const email = await manager.addAccountWithAuthCode(code);
```

### 3. Использование существующих токенов

```typescript
const tokens = {
  access_token: 'ya29...',
  refresh_token: '1//...',
  scope: 'https://www.googleapis.com/auth/gmail.readonly',
  token_type: 'Bearer',
  expiry_date: 1234567890000
};

await manager.addAccountWithTokens(tokens);
```

## Поддерживаемые банки и платежные системы

EmailParser автоматически распознает письма от:

- **Российские банки**: Сбербанк, T-Банк (Тинькофф), Альфа-Банк, ВТБ, Райффайзенбанк
- **Платежные системы**: QIWI, ЮMoney, PayPal
- **Криптобиржи**: Binance, Bybit, OKX, Gate.io

## Примеры

См. папку `examples/`:
- `basic-usage.ts` - базовое использование
- `advanced-usage.ts` - продвинутые примеры с парсингом платежей

## Безопасность

- Токены хранятся локально в зашифрованном виде
- Используйте минимально необходимые OAuth2 scopes
- Не храните `credentials.json` в репозитории
- Регулярно обновляйте токены

## Лицензия

MIT