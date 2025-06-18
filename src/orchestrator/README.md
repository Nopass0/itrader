# Orchestrator Module

Модуль для управления асинхронными задачами с поддержкой интервалов, условий, очередей и сохранения состояния.

## Основные возможности

- **Планирование задач**: по интервалу, cron-выражению или условию
- **Управление очередью**: ограничение параллельных задач, приоритеты
- **Сохранение состояния**: автоматическое сохранение и восстановление
- **Гибкий контекст**: общий контекст для всех задач
- **События**: подробные события о жизненном цикле задач
- **Устойчивость**: повторные попытки, таймауты, обработка ошибок

## Быстрый старт

```typescript
import { Orchestrator } from './orchestrator';

// Создание оркестратора
const orchestrator = new Orchestrator({
  name: 'MyApp',
  context: { counter: 0 },
  statePersistPath: './state.json'
});

// Добавление задачи с интервалом
orchestrator.addInterval('counter', async (ctx) => {
  ctx.shared.counter++;
  console.log(`Count: ${ctx.shared.counter}`);
}, 5000);

// Запуск
await orchestrator.start();
```

## API

### Создание оркестратора

```typescript
const orchestrator = new Orchestrator<ContextType>({
  name?: string,                  // Имя оркестратора
  context?: ContextType,          // Начальный контекст
  statePersistPath?: string,      // Путь для сохранения состояния
  maxConcurrentTasks?: number,    // Макс. параллельных задач (по умолчанию 5)
  defaultTimeout?: number,        // Таймаут по умолчанию в мс (60000)
  errorHandler?: (error, task) => void  // Глобальный обработчик ошибок
});
```

### Методы добавления задач

#### addInterval
Задача выполняется с заданным интервалом:
```typescript
orchestrator.addInterval('task-id', async (context) => {
  // Ваш код
}, 5000); // каждые 5 секунд
```

#### addCron
Задача по cron-расписанию:
```typescript
orchestrator.addCron('backup', async (context) => {
  // Бэкап данных
}, '0 2 * * *'); // каждый день в 2:00
```

#### addOneTime
Однократное выполнение при запуске:
```typescript
orchestrator.addOneTime('init', async (context) => {
  console.log('Инициализация...');
});
```

#### addConditional
Выполнение при условии:
```typescript
orchestrator.addConditional('alert', 
  async (context) => {
    console.log('Критическое значение!');
  },
  (context) => context.shared.value > 100, // условие
  1000 // проверка каждую секунду
);
```

#### addTask
Полная конфигурация задачи:
```typescript
orchestrator.addTask({
  id: 'complex-task',
  name: 'Сложная задача',
  fn: async (context) => { /* код */ },
  interval: 10000,
  priority: 10,
  maxRetries: 3,
  retryDelay: 5000,
  timeout: 30000,
  runOnStart: true,
  condition: (ctx) => ctx.shared.isReady,
  enabled: true
});
```

### Управление оркестратором

```typescript
// Инициализация (загрузка сохраненного состояния)
await orchestrator.initialize();

// Запуск/возобновление
await orchestrator.start();

// Пауза (сохраняет состояние)
await orchestrator.pause();

// Остановка
await orchestrator.stop();

// Управление контекстом
orchestrator.setContext({ newData: 123 });
orchestrator.updateContext({ counter: 5 });
const context = orchestrator.getContext();

// Управление задачами
orchestrator.pauseTask('task-id');
orchestrator.resumeTask('task-id');
orchestrator.removeTask('task-id');

// Получение информации
const tasks = orchestrator.getTasks();
const task = orchestrator.getTask('task-id');
const state = orchestrator.getState();
```

### События

```typescript
orchestrator.on('taskAdded', (task) => {});
orchestrator.on('taskRemoved', (taskId) => {});
orchestrator.on('taskStarted', (task) => {});
orchestrator.on('taskCompleted', (task, result) => {});
orchestrator.on('taskError', (task, error) => {});
orchestrator.on('taskQueued', (task) => {}); // превышен лимит параллельных
orchestrator.on('taskSkipped', (task, reason) => {}); // условие не выполнено
orchestrator.on('started', () => {});
orchestrator.on('paused', () => {});
orchestrator.on('stopped', () => {});
orchestrator.on('stateRestored', (state) => {});
```

## Примеры

См. папку `examples/`:
- `basic.ts` - базовое использование
- `advanced.ts` - продвинутый пример с торговым ботом

## Сохранение состояния

При указании `statePersistPath` оркестратор автоматически:
- Сохраняет состояние при изменениях
- Восстанавливает при вызове `initialize()`
- Сохраняет: контекст, статусы задач, счетчики выполнения
- НЕ сохраняет: функции (восстанавливаются из конфигурации)

## Лучшие практики

1. **Используйте типизацию контекста** для безопасности
2. **Обрабатывайте ошибки** в задачах или глобально
3. **Устанавливайте таймауты** для сетевых операций
4. **Используйте приоритеты** для важных задач
5. **Мониторьте события** для отладки
6. **Сохраняйте состояние** для устойчивости