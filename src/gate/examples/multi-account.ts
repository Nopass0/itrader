/**
 * Пример работы с несколькими аккаунтами
 */

import { GateAccountManager, SessionExpiredError } from '../index';

async function multiAccountExample() {
  const manager = new GateAccountManager({
    cookiesDir: './data/gate-cookies',
    rateLimiterOptions: {
      maxRequests: 240,
      windowMs: 60000
    }
  });

  await manager.initialize();

  // Список аккаунтов
  const accounts = [
    { email: 'account1@example.com', password: 'pass1' },
    { email: 'account2@example.com', password: 'pass2' },
    { email: 'account3@example.com', password: 'pass3' }
  ];

  // Добавляем все аккаунты
  console.log('🔐 Добавление аккаунтов...');
  for (const account of accounts) {
    try {
      await manager.addAccount(account.email, account.password, true);
      console.log(`✅ ${account.email} - добавлен`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${account.email} - ошибка:`, message);
    }
  }

  // Проверяем балансы всех аккаунтов
  console.log('\n💰 Проверка балансов:');
  for (const account of accounts) {
    try {
      const balance = await manager.getBalance(account.email);
      console.log(`   ${account.email}: ${balance.balance} RUB`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ${account.email}: Ошибка - ${message}`);
    }
  }

  // Собираем все доступные транзакции со всех аккаунтов
  console.log('\n📋 Сбор доступных транзакций:');
  const allTransactions = [];
  
  for (const account of accounts) {
    try {
      const transactions = await manager.getAvailableTransactions(account.email);
      console.log(`   ${account.email}: ${transactions.length} транзакций`);
      
      // Добавляем email к каждой транзакции для отслеживания
      transactions.forEach(tx => {
        allTransactions.push({ ...tx, accountEmail: account.email });
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ${account.email}: Ошибка - ${message}`);
    }
  }

  console.log(`\n📊 Всего найдено ${allTransactions.length} транзакций`);

  // Пример использования withAutoRelogin для автоматического повторного входа
  console.log('\n🔄 Пример с автоматическим повторным входом:');
  
  for (const account of accounts) {
    try {
      const result = await manager.withAutoRelogin(
        account.email,
        async (client) => {
          // Эта операция автоматически повторится после входа, если сессия истекла
          const balance = await client.getBalance('RUB');
          const transactions = await client.getAvailableTransactions();
          
          return {
            balance: balance.balance.toString(),
            transactionCount: transactions.length
          };
        }
      );
      
      console.log(`   ${account.email}: Баланс ${result.balance} RUB, ${result.transactionCount} транзакций`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ${account.email}: Ошибка - ${message}`);
    }
  }

  // Обновляем лимиты rate limiter для всех аккаунтов
  console.log('\n⚙️ Обновление лимитов:');
  manager.updateRateLimits(300, 60000); // 300 запросов в минуту
  console.log('   Новый лимит: 300 запросов/мин');

  // Сохраняем все cookies
  console.log('\n💾 Сохранение cookies:');
  await manager.saveAllCookies();
  console.log('   Все cookies сохранены');

  // Показываем финальную статистику
  const finalStats = manager.getRateLimiterStats();
  console.log('\n📊 Финальная статистика:');
  console.log(`   Выполнено запросов: ${finalStats.currentRequests}`);
  console.log(`   Максимум: ${finalStats.maxRequests}`);
  console.log(`   В очереди: ${finalStats.queueLength}`);
}

// Запускаем пример
if (require.main === module) {
  multiAccountExample()
    .then(() => console.log('\n✅ Все операции завершены'))
    .catch((error: unknown) => console.error('❌ Критическая ошибка:', error));
}