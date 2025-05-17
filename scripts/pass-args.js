#!/usr/bin/env node

/**
 * Скрипт для передачи переменных окружения из bash в node.js скрипты
 * Позволяет передавать флаги auto_yes из run.sh в dev.js и start.js
 */

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
  require(scriptToRun);
} else {
  console.error('No script specified to run');
  process.exit(1);
}