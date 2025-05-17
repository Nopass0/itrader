#!/bin/bash
# Скрипт настройки базы данных iTrader
# Устанавливает PostgreSQL напрямую с официального сайта

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

# Проверка наличия sudo прав
if [ "$(id -u)" != "0" ]; then
  log "Для установки PostgreSQL требуются права администратора"
  if ! command -v sudo &> /dev/null; then
    error "Команда sudo не найдена. Запустите скрипт от имени root или установите sudo."
  fi
fi

# Функция установки PostgreSQL
install_postgresql() {
  log "Установка PostgreSQL..."
  
  # Создаем временную директорию для загрузки файлов
  TEMP_DIR=$(mktemp -d)
  cd "$TEMP_DIR"
  
  # Определяем архитектуру системы
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    ARCH="x86_64"
  elif [ "$ARCH" = "aarch64" ]; then
    ARCH="aarch64"
  else
    error "Неподдерживаемая архитектура: $ARCH"
  fi
  
  # Загружаем PostgreSQL
  PG_VERSION="15.4"
  log "Загрузка PostgreSQL $PG_VERSION для $ARCH..."
  wget -q "https://sbp.enterprisedb.com/getfile.jsp?pginstaller=postgresql-$PG_VERSION-1-linux-$ARCH.run" -O postgresql.run
  
  if [ ! -f postgresql.run ]; then
    error "Не удалось загрузить установщик PostgreSQL"
  fi
  
  # Делаем файл исполняемым
  chmod +x postgresql.run
  
  # Устанавливаем PostgreSQL в неинтерактивном режиме
  log "Запуск установщика PostgreSQL (это может занять несколько минут)..."
  ./postgresql.run --mode unattended --superpassword postgres --servicename postgresql-$PG_VERSION
  
  # Проверяем успешность установки
  if ! command -v /opt/PostgreSQL/$PG_VERSION/bin/psql &> /dev/null; then
    error "Установка PostgreSQL не удалась"
  fi
  
  # Добавляем PostgreSQL в PATH
  echo "export PATH=\$PATH:/opt/PostgreSQL/$PG_VERSION/bin" > /etc/profile.d/postgresql.sh
  chmod +x /etc/profile.d/postgresql.sh
  source /etc/profile.d/postgresql.sh
  
  # Очистка
  cd - > /dev/null
  rm -rf "$TEMP_DIR"
  
  success "PostgreSQL $PG_VERSION успешно установлен"
}

# Проверка наличия PostgreSQL
if ! command -v psql &> /dev/null; then
  log "PostgreSQL не найден. Будет выполнена установка..."
  install_postgresql
else
  success "PostgreSQL уже установлен: $(psql --version)"
fi

# Функция для выполнения команд PostgreSQL
pg_cmd() {
  if command -v sudo &> /dev/null; then
    # Если установлен через пакетный менеджер (postgres пользователь)
    if getent passwd postgres &> /dev/null; then
      sudo -u postgres psql -c "$1"
    # Если установлен через скрипт (enterprisedb пользователь)
    elif getent passwd enterprisedb &> /dev/null; then
      sudo -u enterprisedb psql -c "$1"
    else
      # Пробуем найти путь к psql
      local PSQL_PATH
      PSQL_PATH=$(which psql 2>/dev/null || echo "/opt/PostgreSQL/*/bin/psql" 2>/dev/null || echo "")
      if [ -n "$PSQL_PATH" ]; then
        sudo "$PSQL_PATH" -U postgres -c "$1"
      else
        error "Не удалось найти исполняемый файл psql"
      fi
    fi
  else
    # Если sudo недоступен
    psql -U postgres -c "$1"
  fi
}

# Проверка существования пользователя
log "Проверка пользователя БД aitrader..."
if ! pg_cmd "SELECT 1 FROM pg_roles WHERE rolname='aitrader'" | grep -q 1; then
  log "Создание пользователя БД aitrader..."
  pg_cmd "CREATE USER aitrader WITH PASSWORD 'aitraderpassword';"
  pg_cmd "ALTER USER aitrader CREATEDB;"
  success "Пользователь БД создан"
else
  success "Пользователь БД уже существует"
fi

# Проверка существования базы данных
log "Проверка базы данных aitrader..."
if ! pg_cmd "\l" | grep -q aitrader; then
  log "Создание базы данных aitrader..."
  pg_cmd "CREATE DATABASE aitrader OWNER aitrader;"
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
echo "[SUCCESS] Настройка базы данных iTrader завершена успешно!"
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