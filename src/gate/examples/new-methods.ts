/**
 * Пример использования новых методов Gate.io модуля
 */

import { GateAccountManager } from '../index';

async function demonstrateNewMethods() {
  const manager = new GateAccountManager({
    cookiesDir: './data/gate-cookies',
    autoSaveCookies: true
  });

  await manager.initialize();

  const email = 'user@example.com';
  const password = 'password123';

  try {
    // Добавляем и авторизуем аккаунт
    await manager.addAccount(email, password);
    console.log('✅ Аккаунт добавлен');

    // 1. Установка баланса (для тестирования)
    console.log('\n💰 Установка баланса:');
    const newBalance = 50000; // 50,000 RUB
    await manager.setBalance(email, newBalance);
    console.log(`   Баланс установлен: ${newBalance} RUB`);

    // Проверяем баланс
    const balance = await manager.getBalance(email);
    console.log(`   Текущий баланс: ${balance.balance} RUB`);

    // 2. Получение транзакций в ожидании (статус 4)
    console.log('\n⏳ Транзакции в ожидании:');
    const pendingTransactions = await manager.getPendingTransactions(email);
    console.log(`   Найдено ${pendingTransactions.length} транзакций со статусом 4`);
    
    pendingTransactions.forEach(tx => {
      console.log(`   - ID: ${tx.id}, Сумма: ${tx.amount.trader['643']} RUB`);
    });

    // 3. Поиск транзакции по ID
    console.log('\n🔍 Поиск транзакции по ID:');
    const searchId = '12345'; // Пример ID
    const foundTransaction = await manager.searchTransactionById(email, searchId);
    
    if (foundTransaction) {
      console.log(`   Найдена транзакция ${searchId}:`);
      console.log(`   - Статус: ${foundTransaction.status}`);
      console.log(`   - Сумма: ${foundTransaction.amount.trader['643']} RUB`);
      console.log(`   - Метод: ${foundTransaction.method.label}`);
    } else {
      console.log(`   Транзакция ${searchId} не найдена`);
    }

    // 4. Комбинированный пример: поиск и обработка
    console.log('\n🔄 Комбинированный пример:');
    
    // Получаем все ожидающие транзакции
    const pending = await manager.getPendingTransactions(email);
    
    if (pending.length > 0) {
      const firstPending = pending[0];
      console.log(`   Обработка транзакции ${firstPending.id}`);
      
      // Ищем эту транзакцию по ID для подтверждения
      const verified = await manager.searchTransactionById(email, firstPending.id.toString());
      
      if (verified) {
        console.log('   ✅ Транзакция подтверждена через поиск');
        
        // Принимаем транзакцию
        await manager.acceptTransaction(email, verified.id.toString());
        console.log('   ✅ Транзакция принята в работу');
      }
    }

    // 5. Использование прямого клиента для дополнительных операций
    console.log('\n🔧 Прямое использование клиента:');
    const client = manager.getClient(email);
    
    // Можно вызывать методы напрямую
    const directPending = await client.getPendingTransactions();
    console.log(`   Прямой вызов: ${directPending.length} транзакций в ожидании`);

    // Также работает с автоматическим повторным входом
    const result = await manager.withAutoRelogin(email, async (client) => {
      const pending = await client.getPendingTransactions();
      const balance = await client.getBalance('RUB');
      
      return {
        pendingCount: pending.length,
        balance: balance.balance.toString()
      };
    });
    
    console.log(`   Результат с auto-relogin:`);
    console.log(`   - Ожидающих: ${result.pendingCount}`);
    console.log(`   - Баланс: ${result.balance} RUB`);

  } catch (error: unknown) {
    console.error('❌ Ошибка:', error);
  }
}

// Запускаем демонстрацию
if (require.main === module) {
  demonstrateNewMethods()
    .then(() => console.log('\n✅ Демонстрация завершена'))
    .catch((error: unknown) => console.error('❌ Критическая ошибка:', error));
}