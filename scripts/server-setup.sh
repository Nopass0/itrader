#!/bin/bash
# Серверный скрипт настройки iTrader - фокус на PostgreSQL и базе данных
# Предполагает, что Node.js, npm и Bun уже установлены

set -e  # Выход при ошибке

# Функция для вывода сообщений
log() {
  echo "[SETUP] $1"
}

success() {
  echo "[SUCCESS] $1"
}

error() {
  echo "[ERROR] $1"
  exit 1
}

# Проверка наличия PostgreSQL
log "Проверка PostgreSQL..."
if ! command -v psql &> /dev/null; then
  log "Установка PostgreSQL..."
  sudo apt update
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  success "PostgreSQL установлен"
else
  success "PostgreSQL уже установлен"
fi

# Настройка PostgreSQL
log "Настройка PostgreSQL..."

# Проверка существования пользователя
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='aitrader'" | grep -q 1; then
  log "Создание пользователя БД aitrader..."
  sudo -u postgres psql -c "CREATE USER aitrader WITH PASSWORD 'aitraderpassword';"
  sudo -u postgres psql -c "ALTER USER aitrader CREATEDB;"
  success "Пользователь БД создан"
else
  success "Пользователь БД уже существует"
fi

# Проверка существования базы данных
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw aitrader; then
  log "Создание базы данных aitrader..."
  sudo -u postgres psql -c "CREATE DATABASE aitrader OWNER aitrader;"
  success "База данных создана"
else
  success "База данных уже существует"
fi

# Получение текущей директории
PROJECT_ROOT=$(pwd)

# Создание файлов окружения
log "Создание файлов конфигурации..."

# Файл .env для сервера
if [ ! -f "$PROJECT_ROOT/server/.env" ]; then
  cat > "$PROJECT_ROOT/server/.env" << EOF
# Server
PORT=3000
NODE_ENV=production
JWT_SECRET=change_this_in_production
JWT_EXPIRATION=24h

# Database
DATABASE_URL=postgresql://aitrader:aitraderpassword@localhost:5432/aitrader

# CORS
CORS_ORIGINS=http://localhost:3001,https://localhost:3001

# Gate.cx
GATE_API_URL=https://www.gate.cx

# Bybit
BYBIT_API_URL=https://api.bybit.com
BYBIT_TESTNET_API_URL=https://api-testnet.bybit.com
BYBIT_USE_TESTNET=false

# Logger
LOG_LEVEL=info

# Admin
ADMIN_TOKEN=change_this_in_production

# Session refresh interval (in milliseconds)
SESSION_REFRESH_INTERVAL=300000

# Development mode
ALLOW_DEV_ACCESS=false

# Mock data for testing
USE_MOCK_DATA=false
EOF
  success "Файл конфигурации сервера создан"
else
  success "Файл конфигурации сервера уже существует"
fi

# Файл .env для фронтенда
if [ ! -f "$PROJECT_ROOT/frontend/.env.local" ]; then
  cat > "$PROJECT_ROOT/frontend/.env.local" << EOF
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
EOF
  success "Файл конфигурации фронтенда создан"
else
  success "Файл конфигурации фронтенда уже существует"
fi

# Установка зависимостей
log "Установка зависимостей проекта..."
npm install || error "Ошибка установки зависимостей проекта"

# Установка зависимостей сервера
log "Установка зависимостей сервера..."
cd "$PROJECT_ROOT/server"
bun install || error "Ошибка установки зависимостей сервера"

# Инициализация Prisma
log "Инициализация базы данных..."
bun run prisma:generate || error "Ошибка генерации Prisma клиента"

# Применение миграций
log "Применение миграций базы данных..."
bun run prisma:migrate || error "Ошибка применения миграций"

# Создание администратора по умолчанию
log "Создание администратора..."
bun run src/cli.ts create-admin --username admin --password admin --token admin || log "Администратор, возможно, уже существует"

# Установка зависимостей фронтенда
log "Установка зависимостей фронтенда..."
cd "$PROJECT_ROOT/frontend"
npm install || error "Ошибка установки зависимостей фронтенда"

# Возврат в корневую директорию
cd "$PROJECT_ROOT"

# Проверка соединения с базой данных
log "Проверка соединения с базой данных..."
npm run db:check || error "Ошибка проверки соединения с базой данных"

# Сообщение об успешном завершении
echo ""
echo "============================================="
echo "[SUCCESS] Настройка iTrader завершена успешно!"
echo "============================================="
echo "Вы можете запустить сервер:"
echo "  npm run start"
echo ""
echo "Учетные данные администратора по умолчанию:"
echo "  Логин: admin"
echo "  Пароль: admin"
echo "  Токен: admin"
echo ""
echo "Параметры базы данных:"
echo "  Хост: localhost"
echo "  Порт: 5432"
echo "  База данных: aitrader"
echo "  Пользователь: aitrader"
echo "  Пароль: aitraderpassword"
echo "============================================="