# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack TypeScript application for P2P trading automation:
- **Backend**: Bun runtime with Socket.IO WebSocket server on port 3001
- **Frontend**: Next.js 14 with React, Tailwind CSS, and shadcn/ui components
- **Database**: SQLite with Prisma ORM
- **Integrations**: Bybit P2P, Gate.io, Gmail API, MailSlurp

## Key Development Commands

### Backend Development
```bash
# Development with watch mode
bun run dev

# Run application
bun run app

# Database operations
bun run db:generate  # Generate Prisma client after schema changes
bun run db:push      # Apply schema to database
bun run db:migrate   # Run migrations

# Account management
bun run create:admin  # Create admin account
bun run reset:admin   # Reset admin password

# Testing
bun test              # Run all tests
bun test tests/bybit.test.ts  # Run specific test
```

### Frontend Development
```bash
cd frontend
npm run dev           # Start on http://localhost:3000
npm run build         # Build for production
npm run lint          # Run ESLint
npm run test          # Run Jest tests
```

### Quick Start
```bash
./quick-start.sh      # Starts both backend and frontend
```

## Architecture

### Backend Structure
```
src/
├── app.ts                 # Main entry point
├── webserver/            # Socket.IO WebSocket server
│   ├── server.ts         # Server setup
│   ├── controllers/      # WebSocket event handlers
│   └── auth/            # JWT authentication
├── services/            # Business logic
│   ├── bybitP2PManager.ts
│   ├── exchangeRateManager.ts
│   └── receiptProcessor.ts
├── bybit/               # Bybit P2P integration
├── gate/                # Gate.io integration
├── gmail/               # Gmail integration
├── ocr/                 # PDF/Receipt parsing
└── logger/              # Logging system
```

### Frontend Structure
```
frontend/
├── app/panel/           # Admin panel pages
├── components/
│   ├── ui/             # shadcn/ui components
│   └── panel/          # Panel-specific components
├── services/           # API and WebSocket services
├── hooks/              # Custom React hooks
└── contexts/           # React contexts
```

## WebSocket API Pattern

Add new WebSocket endpoints in `src/webserver/controllers/`:
```typescript
socket.on('resource:action', async (data) => {
  try {
    // Validate and process
    socket.emit('resource:response', result);
  } catch (error) {
    logger.error('Error in resource:action', error);
    socket.emit('error', { message: error.message });
  }
});
```

## Important Rules

- никогда не делай всякие тесты в главной директории проекта

# Система логирования

## Использование логгера

В каждом модуле и сервисе используй логгер для записи всех важных событий:

```typescript
import { createLogger } from './logger';

const logger = createLogger('ServiceName', 'ModuleName'); // ModuleName опционально

// Различные уровни логирования:
logger.debug('Debug message', { someData: 123 }, { variable1: 'value' });
logger.info('Info message', { data: {} }, { variables: {} });
logger.warn('Warning message');
logger.error('Error message', error, { context: 'data' });
logger.fatal('Fatal error', error);

// Логирование действий пользователя (isSystem = false):
logger.userAction(
  'User performed action',
  {
    userId: 'user123',
    action: 'create_order',
    method: 'POST',
    path: '/api/orders',
    statusCode: 200,
    duration: 125,
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  },
  { orderId: '123', amount: 1000 },
  { currentBalance: 5000 }
);
```

## Структура лога в базе данных

Каждый лог сохраняется в таблице SystemLog со следующими полями:
- `level` - уровень лога (DEBUG, INFO, WARN, ERROR, FATAL)
- `service` - название сервиса
- `module` - модуль внутри сервиса (опционально)
- `message` - сообщение лога
- `timestamp` - точное время
- `userId` - ID пользователя (для пользовательских действий)
- `action` - действие пользователя
- `method` - HTTP метод
- `path` - путь запроса
- `statusCode` - код ответа
- `duration` - длительность выполнения в мс
- `ip` - IP адрес
- `userAgent` - User Agent
- `error` - объект ошибки (если есть)
- `stack` - стек ошибки
- `data` - любые дополнительные данные в JSON
- `variables` - переменные на момент лога в JSON
- `isSystem` - флаг системный/пользовательский лог

## WebSocket API для логов

```typescript
// Получение логов с фильтрацией
socket.emit('logs:get', {
  level: 'ERROR', // фильтр по уровню
  service: 'BybitP2PManager', // фильтр по сервису
  module: 'orderProcessor', // фильтр по модулю
  userId: 'user123', // фильтр по пользователю
  isSystem: true, // системные или пользовательские
  startDate: '2024-01-01', // начальная дата
  endDate: '2024-01-31', // конечная дата
  search: 'error text', // поиск по всем полям
  limit: 100,
  offset: 0
});

// Получение списка сервисов
socket.emit('logs:services');

// Подписка на real-time логи
socket.emit('logs:subscribe', { service: 'ServiceName' }); // или без service для всех

// Отписка от логов
socket.emit('logs:unsubscribe', { service: 'ServiceName' });
```

## Интеграция на фронтенде

Страница логов доступна по адресу `/panel/logs` и содержит:
- Вкладки "Системные логи" и "Действия пользователей"
- Фильтры по сервису, уровню, поиск
- Real-time обновление логов
- Детальный просмотр каждого лога с раскрытием всех данных
- Экспорт логов в JSON

## Важные правила использования логов

1. **Всегда используй логгер вместо console.log** - все логи должны сохраняться в БД
2. **Логируй все важные события** - старт/стоп сервисов, ошибки, важные действия
3. **Используй правильные уровни**:
   - DEBUG - для отладочной информации
   - INFO - для обычных событий
   - WARN - для предупреждений
   - ERROR - для ошибок, которые можно обработать
   - FATAL - для критических ошибок, требующих перезапуска
4. **Добавляй контекст** - всегда передавай дополнительные данные и переменные
5. **Логируй действия пользователей** - используй userAction для всех API запросов

## Frontend Improvements
- use sonner instead of toast on frontend

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.