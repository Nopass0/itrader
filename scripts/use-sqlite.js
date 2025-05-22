#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Скрипт для включения SQLite в проекте
 * Используется для переключения между PostgreSQL и SQLite
 */

// Путь к директории данных SQLite
const DATA_DIR = path.resolve(process.cwd(), 'data');
// Путь к файлу базы данных SQLite
const SQLITE_DB_PATH = path.join(DATA_DIR, 'aitrader.db');
// Путь к файлу .env сервера
const ENV_FILE = path.resolve(process.cwd(), 'server', '.env');
// Путь к схеме Prisma
const PRISMA_SCHEMA = path.resolve(process.cwd(), 'server', 'prisma', 'schema.prisma');

// Функция для обновления схемы Prisma
function updatePrismaSchema() {
  console.log(chalk.cyan('Обновление схемы Prisma для SQLite...'));
  
  try {
    let schema = fs.readFileSync(PRISMA_SCHEMA, 'utf8');
    
    // Заменяем провайдер базы данных в схеме
    const postgresProvider = /provider\s*=\s*["']postgresql["']/;
    if (postgresProvider.test(schema)) {
      schema = schema.replace(postgresProvider, 'provider = "sqlite"');
      fs.writeFileSync(PRISMA_SCHEMA, schema, 'utf8');
      console.log(chalk.green('Схема Prisma обновлена для SQLite'));
    } else if (schema.includes('provider = "sqlite"')) {
      console.log(chalk.yellow('Схема Prisma уже настроена для SQLite'));
    } else {
      console.log(chalk.yellow('Не удалось обновить схему Prisma. Проверьте файл вручную.'));
    }
  } catch (error) {
    console.error(chalk.red(`Ошибка при обновлении схемы Prisma: ${error.message}`));
    process.exit(1);
  }
}

// Функция для обновления файла .env
function updateEnvFile() {
  console.log(chalk.cyan('Обновление переменных окружения для SQLite...'));
  
  try {
    // Создаем директорию для базы данных SQLite, если её нет
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Создаем пустой файл базы данных SQLite, если его нет
    if (!fs.existsSync(SQLITE_DB_PATH)) {
      fs.writeFileSync(SQLITE_DB_PATH, '', 'utf8');
    }
    
    // Читаем файл .env
    let envContent = '';
    if (fs.existsSync(ENV_FILE)) {
      envContent = fs.readFileSync(ENV_FILE, 'utf8');
    }
    
    // Обновляем или добавляем переменную DATABASE_URL
    const sqliteUrl = `file:${SQLITE_DB_PATH}`;
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=.*(\r?\n|$)/g, `DATABASE_URL=${sqliteUrl}\n`);
    } else {
      envContent += `\nDATABASE_URL=${sqliteUrl}\n`;
    }
    
    // Записываем обновленный файл .env
    fs.writeFileSync(ENV_FILE, envContent, 'utf8');
    console.log(chalk.green('Переменные окружения обновлены для SQLite'));
  } catch (error) {
    console.error(chalk.red(`Ошибка при обновлении переменных окружения: ${error.message}`));
    process.exit(1);
  }
}

// Генерируем клиент Prisma для SQLite
function generatePrismaClient() {
  console.log(chalk.cyan('Генерация клиента Prisma для SQLite...'));
  
  try {
    const { spawnSync } = await import('child_process');
    
    // Переходим в директорию сервера
    process.chdir(path.resolve(process.cwd(), 'server'));
    
    // Генерируем клиент Prisma
    const result = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit' });
    
    if (result.status !== 0) {
      console.error(chalk.red('Ошибка при генерации клиента Prisma'));
      process.exit(1);
    }
    
    console.log(chalk.green('Клиент Prisma сгенерирован для SQLite'));
  } catch (error) {
    console.error(chalk.red(`Ошибка при генерации клиента Prisma: ${error.message}`));
    process.exit(1);
  }
}

// Основная функция
function main() {
  console.log(chalk.cyan('Настройка проекта для использования SQLite...'));
  
  // Обновляем схему Prisma
  updatePrismaSchema();
  
  // Обновляем файл .env
  updateEnvFile();
  
  // Генерируем клиент Prisma
  generatePrismaClient();
  
  console.log(chalk.green('Проект настроен для использования SQLite!'));
  console.log(chalk.yellow('\nВажно: Если у вас уже были данные в PostgreSQL, они не будут доступны в SQLite.'));
  console.log(chalk.yellow('Используйте эту опцию только для разработки или при недоступности PostgreSQL.'));
}

// Запускаем основную функцию
main();