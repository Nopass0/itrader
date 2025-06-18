/**
 * Продвинутые примеры использования Gate.io модуля
 */

import { 
  GateAccountManager, 
  GateClient,
  RateLimiter,
  TransactionStatus,
  GateApiError,
  CloudflareError,
  SessionExpiredError,
  RateLimitError
} from '../index';
import path from 'path';

/**
 * Пример обработки ошибок
 */
async function errorHandlingExample(manager: GateAccountManager) {
  console.log('\n🛡️ Пример обработки ошибок:');
  
  try {
    await manager.getBalance('test@example.com');
  } catch (error: unknown) {
    if (error instanceof SessionExpiredError) {
      console.log('   Сессия истекла, требуется повторный вход');
    } else if (error instanceof CloudflareError) {
      console.log('   Обнаружена защита Cloudflare');
    } else if (error instanceof RateLimitError) {
      console.log(`   Превышен лимит запросов, повтор через ${error.retryAfter} сек`);
    } else if (error instanceof GateApiError) {
      console.log(`   Ошибка API: ${error.message} (код: ${error.code})`);
    } else {
      console.log(`   Неизвестная ошибка: ${error.message}`);
    }
  }
}

/**
 * Пример работы с транзакциями
 */
async function transactionProcessingExample(manager: GateAccountManager, email: string) {
  console.log('\n💸 Обработка транзакций:');
  
  const client = manager.getClient(email);
  
  // Получаем транзакции с фильтром
  const pendingTx = await client.getTransactionsWithFilter({
    status: [TransactionStatus.PENDING, TransactionStatus.IN_PROGRESS],
    limit: 10,
    page: 1
  });
  
  console.log(`   Найдено ${pendingTx.length} активных транзакций`);
  
  for (const tx of pendingTx) {
    console.log(`\n   Транзакция ${tx.id}:`);
    console.log(`     Статус: ${tx.status}`);
    console.log(`     Сумма: ${tx.amount} ${tx.currency}`);
    console.log(`     Метод оплаты: ${tx.paymentMethod}`);
    console.log(`     Покупатель: ${tx.buyerName}`);
    
    // Обработка в зависимости от статуса
    if (tx.status === TransactionStatus.PENDING) {
      // Принимаем транзакцию
      await client.acceptTransaction(tx.id);
      console.log('     ✅ Транзакция принята в работу');
    } else if (tx.status === TransactionStatus.IN_PROGRESS) {
      // Можем подтвердить или отменить
      console.log('     ⏳ Транзакция уже в обработке');
    }
  }
  
  // Получаем историю
  const history = await client.getHistoryTransactions(1);
  console.log(`\n   📜 История: ${history.length} завершенных транзакций`);
}

/**
 * Пример работы с cookies
 */
async function cookieManagementExample() {
  console.log('\n🍪 Управление cookies:');
  
  // Создаем клиент с кастомным rate limiter
  const rateLimiter = new RateLimiter({
    maxRequests: 100,
    windowMs: 30000 // 100 запросов в 30 секунд
  });
  
  const client = new GateClient(rateLimiter, {
    baseUrl: 'https://panel.gate.cx/api/v1',
    timeout: 15000
  });
  
  // Загружаем cookies из файла
  const cookiesPath = path.join('./data/gate-cookies', 'manual-account.json');
  await client.loadCookies(cookiesPath);
  console.log('   Cookies загружены из файла');
  
  // Проверяем авторизацию
  if (await client.isAuthenticated()) {
    console.log('   ✅ Авторизация через cookies успешна');
    
    // Выполняем операции
    const balance = await client.getBalance('RUB');
    console.log(`   Баланс: ${balance.balance} RUB`);
    
    // Сохраняем обновленные cookies
    await client.saveCookies(cookiesPath);
    console.log('   Cookies обновлены и сохранены');
  } else {
    console.log('   ❌ Cookies недействительны, требуется вход');
  }
}

/**
 * Пример мониторинга rate limiter
 */
async function rateLimiterMonitoring(manager: GateAccountManager) {
  console.log('\n📊 Мониторинг Rate Limiter:');
  
  // Функция для отображения статистики
  const showStats = () => {
    const stats = manager.getRateLimiterStats();
    const percentage = (stats.currentRequests / stats.maxRequests * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
    
    console.log(`   [${bar}] ${stats.currentRequests}/${stats.maxRequests} (${percentage}%)`);
    console.log(`   Очередь: ${stats.queueLength} запросов`);
    
    if (stats.currentRequests >= stats.maxRequests * 0.8) {
      console.log('   ⚠️ Приближаемся к лимиту!');
    }
  };
  
  // Создаем нагрузку
  console.log('   Создаем нагрузку...');
  const promises = [];
  
  for (let i = 0; i < 10; i++) {
    promises.push(
      manager.withAutoRelogin('test@example.com', async (client) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return i;
      }).catch(() => {
        // Намеренно игнорируем ошибку
      })
    );
    
    if (i % 3 === 0) {
      showStats();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  await Promise.all(promises);
  console.log('\n   Финальная статистика:');
  showStats();
}

/**
 * Главная функция с примерами
 */
async function runAdvancedExamples() {
  const manager = new GateAccountManager({
    cookiesDir: './data/gate-cookies',
    rateLimiterOptions: {
      maxRequests: 240,
      windowMs: 60000
    },
    autoSaveCookies: true
  });
  
  await manager.initialize();
  
  // Добавляем тестовый аккаунт
  try {
    await manager.addAccount('test@example.com', 'testpass', false);
  } catch (error: unknown) {
    // Игнорируем если уже добавлен
  }
  
  // Запускаем примеры
  await errorHandlingExample(manager);
  
  // Для реальной работы раскомментируйте:
  // await transactionProcessingExample(manager, 'real@example.com');
  // await cookieManagementExample();
  
  await rateLimiterMonitoring(manager);
}

// Запускаем примеры
if (require.main === module) {
  runAdvancedExamples()
    .then(() => console.log('\n✅ Все примеры выполнены'))
    .catch((error: unknown) => console.error('❌ Ошибка:', error));
}