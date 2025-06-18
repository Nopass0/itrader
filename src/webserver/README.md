# WebServer Module - Socket.IO API

## Обзор

Модуль веб-сервера предоставляет Socket.IO API для управления всей системой через веб-интерфейс или клиентские приложения.

## Архитектура

```
src/webserver/
├── auth/
│   ├── authManager.ts      # Управление аутентификацией и токенами
│   └── sessionManager.ts    # Управление сессиями
├── controllers/
│   ├── accountController.ts     # Управление аккаунтами системы
│   ├── transactionController.ts # Управление транзакциями
│   ├── payoutController.ts      # Управление выплатами
│   ├── advertisementController.ts # Управление объявлениями
│   ├── exchangeRateController.ts # Управление курсами валют
│   ├── chatController.ts         # Управление чатами
│   ├── templateController.ts     # Управление шаблонами
│   └── orchestratorController.ts # Управление оркестратором
├── events/
│   ├── eventTypes.ts        # Типы событий Socket.IO
│   └── eventHandlers.ts     # Обработчики событий
├── middleware/
│   ├── auth.ts             # Middleware аутентификации
│   └── validation.ts       # Middleware валидации
├── types/
│   └── index.ts            # TypeScript типы
├── utils/
│   ├── password.ts         # Утилиты для паролей
│   └── pagination.ts       # Утилиты пагинации
├── server.ts               # Основной файл сервера
└── index.ts               # Точка входа
```

## Функциональность

### 1. Управление аккаунтами системы
- **Создание аккаунта**: `account:create` - создает аккаунт с автогенерацией пароля
- **Удаление аккаунта**: `account:delete` - удаляет аккаунт
- **Редактирование аккаунта**: `account:update` - изменяет данные аккаунта
- **Список аккаунтов**: `account:list` - получить список всех аккаунтов
- **Авторизация**: `auth:login` - вход по логину/паролю, получение токена

### 2. Управление транзакциями
- **Список транзакций**: `transaction:list` - все транзакции с пагинацией
- **Детали транзакции**: `transaction:get` - подробная информация
- **Обновление статуса**: `transaction:updateStatus` - изменить статус
- **Добавление кастомных статусов**: `transaction:addCustomStatus`

### 3. Управление выплатами
- **Список выплат**: `payout:list` - все выплаты из БД
- **Детали выплаты**: `payout:get` - подробная информация
- **Обновление выплаты**: `payout:update` - изменить данные

### 4. Управление объявлениями Bybit
- **Список объявлений**: `advertisement:list` - все объявления
- **Создание объявления**: `advertisement:create` - создать новое
- **Редактирование**: `advertisement:update` - изменить параметры
- **Удаление**: `advertisement:delete` - удалить объявление
- **Активные объявления**: `advertisement:listActive` - по каждому аккаунту

### 5. Управление аккаунтами платформ
- **Bybit аккаунты**:
  - `bybit:addAccount` - добавить аккаунт
  - `bybit:removeAccount` - удалить аккаунт
  - `bybit:listAccounts` - список аккаунтов
  - `bybit:getBalance` - баланс (активный/замороженный)
  
- **Gate аккаунты**:
  - `gate:addAccount` - добавить аккаунт
  - `gate:removeAccount` - удалить аккаунт
  - `gate:listAccounts` - список аккаунтов
  - `gate:setBalance` - установить баланс вручную
  
- **Gmail аккаунты**:
  - `gmail:authorize` - авторизоваться в Gmail
  - `gmail:listAccounts` - список аккаунтов
  - `gmail:getReceipts` - получить все чеки

### 6. Управление курсами валют
- **Получить текущий курс**: `rate:get`
- **Установить константный курс**: `rate:setConstant`
- **Переключить режим**: `rate:toggleMode` (константный/автоматический)
- **История курсов**: `rate:history`

### 7. Управление оркестратором
- **Поставить на паузу**: `orchestrator:pause`
- **Снять с паузы**: `orchestrator:resume`
- **Статус**: `orchestrator:status`
- **Перезапуск задач**: `orchestrator:restartTask`

### 8. Управление чатами и ордерами
- **Список ордеров**: `order:list` - все ордера по аккаунтам
- **Детали ордера**: `order:get` - информация с чатом
- **Получить чат**: `chat:get` - сообщения чата
- **Отправить сообщение**: `chat:sendMessage` - отправка вручную

### 9. Управление шаблонами
- **Шаблон объявления (remark)**:
  - `template:getRemark` - получить текущий
  - `template:setRemark` - установить новый
  
- **Шаблоны переписки**:
  - `template:chat:list` - список этапов
  - `template:chat:addStep` - добавить этап
  - `template:chat:updateStep` - изменить этап
  - `template:chat:deleteStep` - удалить этап
  - `template:chat:reorderSteps` - изменить порядок
  
- **Группы ответов**:
  - `template:response:addGroup` - создать группу
  - `template:response:updateGroup` - изменить группу
  - `template:response:deleteGroup` - удалить группу
  - `template:response:listGroups` - список групп

### 10. Настройка реакций на ответы
- **Структура группы ответов**:
  ```typescript
  interface ResponseGroup {
    id: string;
    name: string;
    keywords: string[]; // ["да", "ок", "yes"]
    action: {
      type: 'nextStep' | 'setStatus' | 'customMessage';
      stepId?: number;
      status?: string;
      message?: string;
      repeatQuestion?: boolean;
    };
  }
  ```

- **Реакция на неопознанный ответ**:
  ```typescript
  interface UnknownResponseAction {
    showMessage?: boolean;
    message?: string;
    repeatQuestion?: boolean;
    setStatus?: string;
    goToStep?: number;
  }
  ```

## Пагинация

Все методы списков поддерживают пагинацию:

```typescript
interface PaginationParams {
  page?: number;      // Номер страницы (default: 1)
  limit?: number;     // Количество элементов (default: 20, max: 100)
  cursor?: string;    // Курсор для cursor-based пагинации
  sortBy?: string;    // Поле сортировки
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
  };
}
```

## Аутентификация

### Вход в систему
```typescript
// Запрос
socket.emit('auth:login', {
  username: 'admin',
  password: 'password123'
});

// Ответ
{
  success: true,
  token: 'jwt-token-here',
  user: {
    id: 'user-id',
    username: 'admin',
    role: 'admin'
  }
}
```

### Использование токена
```typescript
// При подключении
const socket = io('http://localhost:3000', {
  auth: {
    token: 'jwt-token-here'
  }
});

// Или после подключения
socket.emit('auth:authenticate', { token: 'jwt-token-here' });
```

## События реального времени

Сервер отправляет события при изменениях:

- `transaction:updated` - обновление транзакции
- `payout:updated` - обновление выплаты
- `order:new` - новый ордер
- `chat:message` - новое сообщение в чате
- `rate:changed` - изменение курса
- `orchestrator:statusChanged` - изменение статуса оркестратора

## Обработка ошибок

Все ошибки возвращаются в стандартном формате:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## CLI команды

Управление аккаунтами через CLI:

```bash
# Создать аккаунт
bun run cli.ts webserver:account:create <username>

# Удалить аккаунт
bun run cli.ts webserver:account:delete <username>

# Список аккаунтов
bun run cli.ts webserver:account:list

# Сбросить пароль
bun run cli.ts webserver:account:reset-password <username>
```