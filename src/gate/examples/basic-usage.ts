/**
 * Базовый пример использования Gate.io модуля
 */

import { GateAccountManager } from '../index';

async function basicExample() {
  // Создаем менеджер аккаунтов
  const manager = new GateAccountManager({
    cookiesDir: './data/gate-cookies',
    rateLimiterOptions: {
      maxRequests: 240,        // 240 запросов
      windowMs: 60000         // в минуту
    },
    autoSaveCookies: true     // Автоматически сохранять cookies
  });

  // Инициализируем менеджер
  await manager.initialize();

  try {
    // Добавляем аккаунт и автоматически входим
    await manager.addAccount('user@example.com', 'password123');
    console.log('✅ Аккаунт добавлен и авторизован');

    // Получаем баланс
    const balance = await manager.getBalance('user@example.com', 'RUB');
    console.log(`💰 Баланс: ${balance.balance} RUB`);
    console.log(`   Доступно: ${balance.available} RUB`);
    console.log(`   Заблокировано: ${balance.locked} RUB`);

    // Получаем доступные транзакции
    const transactions = await manager.getAvailableTransactions('user@example.com');
    console.log(`\n📋 Найдено ${transactions.length} доступных транзакций`);

    // Обрабатываем первую транзакцию
    if (transactions.length > 0) {
      const tx = transactions[0];
      console.log(`\n🔄 Обработка транзакции ${tx.id}:`);
      console.log(`   Сумма: ${tx.amount.trader['643']} RUB`);
      console.log(`   Метод: ${tx.method.label}`);

      // Принимаем транзакцию
      await manager.acceptTransaction('user@example.com', tx.id.toString());
      console.log('✅ Транзакция принята');

      // Подтверждаем с чеком (если есть файл)
      // await manager.approveTransactionWithReceipt(
      //   'user@example.com',
      //   tx.id.toString(),
      //   './receipts/receipt.pdf'
      // );
    }

    // Получаем список всех аккаунтов
    const accounts = manager.getAccounts();
    console.log('\n👥 Список аккаунтов:');
    accounts.forEach(acc => {
      console.log(`   - ${acc.email}: ${acc.isActive ? 'Активен' : 'Неактивен'}, Cookies: ${acc.hasCookies ? 'Есть' : 'Нет'}`);
    });

    // Проверяем статистику rate limiter
    const stats = manager.getRateLimiterStats();
    console.log('\n📊 Статистика Rate Limiter:');
    console.log(`   Текущих запросов: ${stats.currentRequests}/${stats.maxRequests}`);
    console.log(`   В очереди: ${stats.queueLength}`);

  } catch (error: unknown) {
    console.error('❌ Ошибка:', error);
  }
}

// Запускаем пример
if (require.main === module) {
  basicExample()
    .then(() => console.log('\n✅ Пример завершен'))
    .catch((error: unknown) => console.error('❌ Критическая ошибка:', error));
}