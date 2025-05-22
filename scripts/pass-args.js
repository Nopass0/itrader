#!/usr/bin/env node

/**
 * Скрипт для передачи переменных окружения из bash в node.js скрипты
 * Позволяет передавать флаги auto_yes из run.sh в dev.js и start.js
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Проверяем, передан ли флаг --yes или AUTO_YES
if (process.argv.includes('--yes') || process.argv.includes('--y') || process.env.AUTO_YES === 'true') {
  process.env.AUTO_YES = 'true';
  console.log('\x1b[34m%s\x1b[0m', 'Automatic mode enabled: will answer "yes" to all prompts');
}

// Проверяем, передан ли флаг --sqlite3 или USE_SQLITE
if (process.argv.includes('--sqlite3') || process.env.USE_SQLITE === 'true') {
  process.env.USE_SQLITE = 'true';
  console.log('\x1b[34m%s\x1b[0m', 'SQLite mode enabled');
}

// Запускаем указанный файл
const scriptToRun = process.argv[2];

if (scriptToRun) {
  // Получаем абсолютный путь к скрипту относительно корневой директории проекта
  const projectRoot = path.resolve(__dirname, '..');
  const absolutePath = path.resolve(projectRoot, scriptToRun);
  
  try {
    // Проверяем существование файла
    if (!fs.existsSync(absolutePath)) {
      // Если файл не найден, попробуем запустить процессы напрямую
      console.log(`Script not found at ${absolutePath}`);
      console.log(`Falling back to direct process launch...`);
      
      // Запускаем процессы вручную
      if (scriptToRun.includes('dev.js')) {
        console.log('Starting development mode manually...');
        
        // Создаем и запускаем процессы сервера и фронтенда
        const serverProc = spawn('bun', ['run', 'dev'], { 
          cwd: path.join(projectRoot, 'server'),
          stdio: 'inherit',
          env: { ...process.env }
        });
        
        const frontendProc = spawn('npm', ['run', 'dev'], {
          cwd: path.join(projectRoot, 'frontend'),
          stdio: 'inherit',
          env: { ...process.env }
        });
        
        // Обработка завершения процессов
        process.on('SIGINT', () => {
          console.log('Shutting down development servers...');
          serverProc.kill('SIGINT');
          frontendProc.kill('SIGINT');
          process.exit(0);
        });
        
        // Ждем завершения обоих процессов
        serverProc.on('close', (code) => {
          console.log(`Server process exited with code ${code}`);
        });
        
        frontendProc.on('close', (code) => {
          console.log(`Frontend process exited with code ${code}`);
        });
        
        // Держим процесс запущенным
        console.log('Development servers are running. Press Ctrl+C to stop.');

        // Бесконечный таймер для поддержания работы процесса
        setInterval(() => {}, 60000);
      } else {
        console.error(`Cannot handle script: ${scriptToRun}`);
        process.exit(1);
      }
    } else {
      // Если файл существует, импортируем его (динамический импорт для ES modules)
      console.log(`Running script: ${absolutePath}`);
      await import(absolutePath);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
} else {
  console.error('No script specified to run');
  process.exit(1);
}