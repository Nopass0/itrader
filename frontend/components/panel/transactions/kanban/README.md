# Kanban Board для транзакций

## Структура компонентов

### Основные компоненты

- **Board.tsx** - Главный компонент доски Kanban
- **Column.tsx** - Компонент колонки
- **Card.tsx** - Базовый компонент карточки с drag & drop
- **KanbanContext.tsx** - Контекст для управления состоянием

### Карточки по типам (cards/)

- **PayoutCard.tsx** - Карточка для выплат (stage 0)
- **TransactionCard.tsx** - Карточка для транзакций (stages 2-7)
- **AdvertisementCard.tsx** - Карточка для объявлений (stage 1)
- **AppealCard.tsx** - Карточка для апелляций (stage 9)

### Хуки

- **useKanban.ts** - Основная логика управления данными и стадиями

## Стадии Kanban

0. **Выплаты из gate** - Выплаты со статусом < 8
1. **Объявления** - Активные объявления
2. **Ордер** - Ожидающие ордера
3. **Чат** - Первое сообщение от контрагента
4. **Оплачено контрагентом** - Статус PAID
5. **Чек подтверждён** - Внутренняя проверка
6. **Отпуск средств** - Активы отпущены
7. **Завершено** - FINISHED
8. **Отменено контрагентом** - CancelledByBuyer
9. **Апелляция** - DISPUTE (с подстадиями 9.1-9.8)
10. **Оплата отмененной сделки** - Компенсация
11. **Другое** - Ручное размещение

## Особенности

1. **Drag & Drop** - Перетаскивание доступно только в стадию 9 (Апелляция)
2. **Горизонтальная прокрутка** - Поддержка drag-scroll как в Trello
3. **Real-time обновления** - Через WebSocket
4. **Адаптивные карточки** - Разные типы карточек для разных стадий

## Использование

```tsx
import { KanbanBoard } from '@/components/panel/transactions/kanban';

<KanbanBoard
  transactions={transactions}
  payouts={payouts}
  advertisements={advertisements}
  loading={loading}
  onRefresh={handleRefresh}
/>
```

## Настройка цветов стадий

Цвета и стили стадий настраиваются в `KANBAN_STAGES` в Board.tsx:

```tsx
export const KANBAN_STAGES = {
  0: {
    title: 'Выплаты из gate',
    color: 'bg-slate-500',
    textColor: 'text-slate-50',
    borderColor: 'border-slate-200',
  },
  // ...
};
```