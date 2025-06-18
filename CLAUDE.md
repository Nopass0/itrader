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

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.