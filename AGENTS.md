# AI Trader - Кодстайл и архитектура проекта

## Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Архитектура](#архитектура)
3. [Стиль кода](#стиль-кода)
4. [Организация файлов](#организация-файлов)
5. [Работа с API](#работа-с-api)
6. [Документирование кода](#документирование-кода)
7. [CI/CD](#cicd)
8. [Чеклисты для ревью](#чеклисты-для-ревью)
9. [Рекомендации для ИИ агентов](#рекомендации-для-ии-агентов)

## Обзор проекта

AI Trader — это платформа для интеграции с торговыми биржами Gate.cx и Bybit. Проект состоит из серверной части (backend) и клиентской части (frontend).

### Стек технологий

**Backend:**
- Bun (JavaScript/TypeScript runtime)
- TypeScript
- Elysia.js (фреймворк для API)
- Socket.io (веб-сокеты)
- Prisma ORM (база данных PostgreSQL)

**Frontend:**
- Next.js (React-фреймворк)
- TypeScript
- Shadcn/UI (компоненты)
- Tailwind CSS (стили)
- Framer Motion (анимации)
- Lucide React (иконки)
- Zustand (состояние)

## Архитектура

### Серверная часть (Backend)

Серверная часть использует модульную архитектуру и следует принципам чистой архитектуры.

#### Слои приложения

1. **Маршруты (Routes)** - обработчики HTTP-запросов, валидация входных данных
2. **Сервисы (Services)** - бизнес-логика, интеграция с внешними API
3. **Модели данных (Models)** - определение схемы данных через Prisma
4. **Утилиты (Utils)** - вспомогательные функции

#### Структура директорий

```
/server
├── prisma/            # Prisma ORM схемы и миграции
├── src/
│   ├── config/        # Конфигурация приложения
│   ├── database/      # Скрипты для управления БД
│   ├── middleware/    # Middleware для Elysia
│   ├── routes/        # Маршруты API
│   │   ├── auth/      # Аутентификация
│   │   ├── gate/      # Gate.cx API
│   │   ├── bybit/     # Bybit API
│   │   └── admin/     # Административный API
│   ├── services/      # Сервисы
│   └── utils/         # Утилиты
└── tests/             # Тесты
```

### Клиентская часть (Frontend)

Клиентская часть использует компонентную архитектуру Next.js и принципы атомарного дизайна.

#### Слои приложения

1. **Страницы (Pages)** - страницы приложения
2. **Компоненты (Components)** - UI-компоненты
3. **Хуки (Hooks)** - React-хуки и логика
4. **Хранилища (Stores)** - управление состоянием с Zustand
5. **API** - взаимодействие с API

#### Структура директорий

```
/frontend
├── app/               # Маршрутизация Next.js
│   ├── api/           # API-маршруты
│   ├── auth/          # Страницы аутентификации
│   ├── dashboard/     # Панель управления
│   ├── gate/          # Страницы Gate.cx
│   └── bybit/         # Страницы Bybit
├── components/        # Компоненты React
│   ├── ui/            # Базовые UI-компоненты
│   ├── forms/         # Формы
│   └── layouts/       # Макеты
├── hooks/             # Пользовательские хуки
├── lib/               # Утилиты и вспомогательные функции
├── public/            # Статические файлы
├── store/             # Zustand хранилища
└── types/             # TypeScript интерфейсы
```

## Стиль кода

### Общие правила

1. **TypeScript** - используется везде, вместо JavaScript
2. **Строгая типизация** - использовать строгую типизацию (strict: true)
3. **Интерфейсы вместо типов** - использовать интерфейсы для объектов и классов
4. **ESLint** - следовать правилам линтера
5. **Комментарии** - комментировать сложные участки кода и функции

### Именование

1. **camelCase** - для переменных, функций, методов
2. **PascalCase** - для классов, интерфейсов, компонентов React
3. **UPPER_SNAKE_CASE** - для констант
4. **Префиксы** - избегать префиксов типа (например, isThing вместо bIsThing)
5. **Семантические имена** - имена должны отражать назначение сущностей

### Backend

1. **Асинхронность** - использовать async/await вместо колбэков
2. **Обработка ошибок** - всегда обрабатывать ошибки в try/catch блоках
3. **Логирование** - использовать логгер вместо console.log
4. **Валидация** - валидировать все входные данные с помощью схем

### Frontend

1. **Компоненты** - функциональные компоненты и хуки вместо классовых компонентов
2. **Состояние** - использовать Zustand для глобального состояния
3. **Tailwind** - использовать утилиты Tailwind вместо внешних CSS
4. **Мемоизация** - оптимизировать ресурсоемкие вычисления с useMemo и useCallback

## Организация файлов

### Backend

1. **Один маршрут - один файл** - каждый эндпоинт должен быть в отдельном файле
2. **Группировка по ресурсам** - файлы группируются по ресурсам, которые они обрабатывают
3. **Документация** - каждый маршрут должен иметь документацию Swagger
4. **index.ts** - экспортирует все публичные части модуля

### Frontend

1. **Компоненты** - один компонент - один файл
2. **Модульность** - разделять компоненты на маленькие переиспользуемые части
3. **Страницы** - страницы должны содержать минимум логики, основная логика - в хуках и хранилищах
4. **Адаптивность** - все страницы должны адаптироваться под различные устройства

## Работа с API

### Backend

1. **Структура ответа** - единая структура ответа API:
   ```typescript
   {
     success: boolean;
     data: T | null;
     error: string | null;
   }
   ```

2. **Пагинация** - для списков использовать пагинацию:
   ```typescript
   {
     success: true,
     data: {
       items: T[];
       meta: {
         page: number;
         limit: number;
         total: number;
         has_next: boolean;
       }
     },
     error: null
   }
   ```

3. **Статус-коды** - использовать соответствующие HTTP-статусы:
   - 200 - OK
   - 400 - Bad Request
   - 401 - Unauthorized
   - 403 - Forbidden
   - 404 - Not Found
   - 500 - Internal Server Error

4. **Версионирование** - использовать префикс для возможного версионирования в будущем

### Frontend

1. **Запросы к API** - использовать хуки Zustand и axios для запросов
2. **Обработка ошибок** - всегда обрабатывать ошибки API и показывать уведомления
3. **Кэширование** - кэшировать результаты запросов для улучшения производительности
4. **Оптимистичные обновления** - использовать для улучшения UX

## Глазеоморфизм

Глазеоморфизм (Glassmorphism) - это стилистическое направление в дизайне интерфейсов, характеризующееся использованием прозрачности, размытия и многослойности.

### Основные принципы

1. **Прозрачность** - полупрозрачный фон элементов (background-color с opacity)
2. **Размытие фона** - backdrop-filter: blur() для создания эффекта матового стекла
3. **Тонкие границы** - светлые границы для создания эффекта стекла
4. **Многослойность** - наложение элементов друг на друга для создания глубины
5. **Легкие тени** - мягкие тени для усиления эффекта глубины

### Реализация в Tailwind CSS

В проекте реализован класс .glassmorphism, который можно применять к элементам:

```tsx
<Card className="glassmorphism">
  {/* Содержимое карточки */}
</Card>
```

## Документирование кода

### Требования к документации

1. **Обязательная документация**:
   - Все публичные функции и методы
   - Все компоненты React
   - Все маршруты API
   - Все модели данных
   - Все хуки

2. **Формат документации**:
   - JSDoc для функций, методов и классов
   - Комментарии в начале файла описывающие его назначение
   - Swagger/OpenAPI для API-эндпоинтов
   - Markdown файлы в /docs для общей документации

3. **Структура JSDoc**:
   ```typescript
   /**
    * Описание функции
    *
    * @param {Type} paramName - Описание параметра
    * @returns {ReturnType} - Описание возвращаемого значения
    * @throws {ErrorType} - Когда может быть выброшено исключение
    * @example
    * // Пример использования
    * const result = myFunction('example');
    */
   ```

### Документация в /docs

**Обязательно** создавать и поддерживать документацию в формате Markdown в директории `/docs`. Для каждого созданного или измененного файла необходимо обновлять соответствующую документацию.

Структура документации:

```
/docs
├── server/            # Документация по бэкенду
│   ├── api/           # Документация по API
│   ├── models/        # Документация по моделям данных
│   └── services/      # Документация по сервисам
├── frontend/          # Документация по фронтенду
│   ├── components/    # Документация по компонентам
│   ├── hooks/         # Документация по хукам
│   └── store/         # Документация по хранилищам
└── api/               # OpenAPI документация
```

Для каждого файла код должен создавать или обновлять соответствующий `.md` файл в директории `/docs` с описанием функциональности, параметрами, примерами использования и другой релевантной информацией.

## CI/CD

### Проверки при коммите

1. **Линтинг** - проверка кода с помощью ESLint
2. **Типизация** - проверка типов с помощью TypeScript
3. **Форматирование** - форматирование кода с помощью Prettier
4. **Тесты** - запуск модульных тестов

### Проверки при PR

1. **Все проверки коммита**
2. **Интеграционные тесты**
3. **E2E тесты**
4. **Проверка производительности**

## Чеклисты для ревью

### Бэкенд

- [ ] Код следует принципам чистой архитектуры
- [ ] Все входные данные валидируются
- [ ] Обработаны все возможные ошибки
- [ ] Добавлены необходимые логи
- [ ] Написана документация API
- [ ] Добавлены тесты

### Фронтенд

- [ ] Компоненты оптимизированы для производительности
- [ ] Используется мемоизация где необходимо
- [ ] Корректная обработка ошибок API
- [ ] Интерфейс адаптирован под все устройства
- [ ] Доступность (a11y) соблюдена
- [ ] Компоненты документированы

## Рекомендации для ИИ агентов

### Общие рекомендации

1. **Документация** - всегда создавать или обновлять документацию в `/docs` для каждого файла в формате Markdown
2. **Соблюдение архитектуры** - строго следовать архитектуре проекта, не вносить исключений
3. **Полнота** - при создании новых функций реализовывать их полностью, включая frontend и backend части
4. **Тесты** - создавать тесты для новой функциональности
5. **Безопасность** - уделять особое внимание безопасности, особенно при работе с API ключами и аутентификацией
6. **Документирование изменений** - документировать все внесенные изменения в директории `/docs/agents` в формате Markdown, включая обоснование изменений, шаги реализации и примеры использования

### Дизайн и UI рекомендации

1. **Соблюдение дизайн-системы** - строго следовать дизайн-системе, описанной в документе `/docs/DESIGN_GUIDELINES.md`
2. **Глазеоморфизм** - использовать принципы глазеоморфизма для всех UI компонентов:
   - Применять классы `glass`, `glass-card`, `glass-button` и т.д.
   - Соблюдать рекомендации по прозрачности, размытию и многослойности
   - Использовать корректные CSS-переменные для согласованности эффектов
3. **UI улучшения** - применять современные техники улучшения UI:
   - Интеграция анимированных эмоджи Telegram
   - Частичные эффекты с tsparticles для фонов
   - Анимации компонентов с использованием Framer Motion
   - Градиентные текстовые эффекты для акцентов
   - Улучшенные toast-уведомления с глазеоморфизмом
4. **Адаптивность** - обеспечивать полную адаптивность на всех устройствах
5. **Доступность** - строго соблюдать правила доступности (a11y)

### Backend рекомендации

1. **Валидация** - всегда валидировать входные данные, используя Zod или встроенные в Elysia.js схемы
2. **Ответы API** - использовать единую структуру ответов API
3. **Логирование** - логировать все важные действия и ошибки
4. **Транзакции БД** - использовать транзакции при множественных операциях с БД
5. **Обработка ошибок** - всегда использовать try/catch и не допускать необработанных исключений

### Frontend рекомендации

1. **Zustand** - использовать Zustand для управления состоянием и API запросов
2. **Компоненты** - разделять большие компоненты на маленькие переиспользуемые части
3. **Типизация** - строго типизировать все props, состояния, и функции
4. **Адаптивность** - тестировать на всех размерах экрана (mobile, tablet, desktop)
5. **Доступность** - соблюдать правила доступности (семантические теги, aria-атрибуты, и т.д.)
6. **Анимации** - использовать Framer Motion для всех анимаций интерфейса

### Работа с файлами

1. **Создание файлов**:
   - При создании нового файла обязательно создать соответствующий `.md` в `/docs`
   - Следовать структуре директорий проекта
   - Добавлять заголовок с описанием файла
   - Для значимых изменений создавать документацию в `/docs/agents` с описанием процесса

2. **Изменение файлов**:
   - Обновлять соответствующую документацию в `/docs`
   - Сохранять существующий стиль кода
   - Не менять архитектуру без обсуждения
   - Документировать внесенные изменения в `/docs/agents`

3. **Перемещение файлов**:
   - Обновлять все импорты в других файлах
   - Обновлять пути в документации
   - Отразить структурные изменения в документации

### Документирование работы в /docs/agents

Для каждого значимого изменения или новой функциональности агенты должны создавать документацию в директории `/docs/agents` по следующему шаблону:

1. **Имя файла**: `YYYY-MM-DD_краткое-описание.md`

2. **Структура документа**:
   ```markdown
   # Название изменения или функциональности

   **Дата**: YYYY-MM-DD
   **Автор**: [Имя ИИ агента]

   ## Описание
   Краткое описание внесенных изменений или новой функциональности.

   ## Обоснование
   Почему были внесены эти изменения, какую проблему они решают.

   ## Технические детали
   Подробное описание технической реализации, включая:
   - Затронутые файлы
   - Использованные технологии
   - Архитектурные решения

   ## Примеры использования
   Примеры кода, демонстрирующие использование новой функциональности.

   ## Скриншоты (для UI-изменений)
   Скриншоты до и после изменений (если применимо).

   ## Тестирование
   Описание проведенных тестов и их результаты.
   ```

3. **Рекомендации по документированию**:
   - Писать четко и лаконично
   - Включать примеры кода
   - Объяснять сложные концепции
   - Указывать принятые компромиссы и альтернативные решения
   - Для UI-изменений обязательно включать описание соответствия дизайн-системе

### Настройка окружения

1. **Настройка базы данных** - для установки и настройки БД и зависимостей проекта:
   ```bash
   # Для PostgreSQL (по умолчанию)
   ./scripts/db-setup.sh

   # Для SQLite
   ./scripts/db-setup.sh --sqlite3
   # или
   npm run install:sqlite
   ```
   Скрипт устанавливает базу данных (PostgreSQL или SQLite), настраивает её и устанавливает зависимости проекта. PostgreSQL устанавливается напрямую с официального сайта (без использования репозиториев Ubuntu). Для разработки или при недоступности PostgreSQL можно использовать SQLite.

2. **Быстрая автоматическая настройка** - для полностью автоматической настройки окружения на новой машине без запросов и подтверждений использовать one-liner:
   ```bash
   curl -s https://raw.githubusercontent.com/username/aitrader/main/scripts/quicksetup.sh | bash
   ```
   или скрипт `./scripts/quicksetup.sh` из репозитория

3. **Стандартная автоматическая настройка** - для настройки окружения на новой машине использовать скрипт `./scripts/setup.sh`, который:
   - Устанавливает все необходимые зависимости (Node.js, Bun, PostgreSQL)
   - Настраивает базу данных и применяет миграции
   - Создает файлы конфигурации с переменными окружения
   - Генерирует SSL-сертификаты для локальной разработки
   - Создает тестового администратора

4. **Переменные окружения** - не хардкодить значения, использовать переменные окружения через файлы `.env`:
   - Для сервера: `/server/.env`
   - Для фронтенда: `/frontend/.env.local`

5. **Модификация скриптов настройки** - при добавлении новых зависимостей или переменных окружения обновлять скрипты `./scripts/setup.sh`, `./scripts/quicksetup.sh` и `./scripts/db-setup.sh`

### Развертывание

1. **Docker** - проверять работоспособность в Docker окружении
2. **Переменные окружения** - не хардкодить значения, использовать переменные окружения
3. **SSL** - поддерживать SSL для продакшена
4. **Мониторинг** - добавлять необходимые метрики и логи для мониторинга