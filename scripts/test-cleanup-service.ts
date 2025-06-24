#!/usr/bin/env tsx
/**
 * Скрипт для тестирования сервиса очистки объявлений
 */

import { PrismaClient } from '../generated/prisma';
import { BybitP2PManagerService } from '../src/services/bybitP2PManager';
import { CleanupAdvertisementsService } from '../src/services/cleanupAdvertisementsService';
import { createLogger } from '../src/logger';

const prisma = new PrismaClient();
const logger = createLogger('TestCleanup');

async function main() {
  try {
    logger.info('Starting cleanup test...');
    console.log('🧪 Testing Cleanup Advertisements Service...\n');

    // Получаем статистику до очистки
    const beforeStats = await prisma.transaction.count({
      where: {
        status: { in: ['cancelled', 'cancelled_by_counterparty', 'failed', 'stupid'] },
        advertisementId: { not: null }
      }
    });

    console.log(`📊 Found ${beforeStats} cancelled transactions with advertisements\n`);

    // Инициализируем сервисы
    console.log('🚀 Initializing services...');
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const cleanupService = new CleanupAdvertisementsService(bybitManager);

    // Запускаем очистку
    console.log('🧹 Running cleanup...\n');
    await cleanupService.forceCleanup();

    // Получаем статистику после очистки
    const afterStats = await prisma.transaction.count({
      where: {
        status: { in: ['cancelled', 'cancelled_by_counterparty', 'failed', 'stupid'] },
        advertisementId: { not: null }
      }
    });

    console.log(`\n✅ Cleanup completed!`);
    console.log(`📊 Remaining transactions with advertisements: ${afterStats}`);
    console.log(`🗑️  Cleaned up ${beforeStats - afterStats} advertisements`);

    // Показываем примеры очищенных транзакций
    if (beforeStats > afterStats) {
      const cleanedTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ['cancelled', 'cancelled_by_counterparty', 'failed', 'stupid'] },
          advertisementId: null
        },
        take: 5,
        orderBy: { updatedAt: 'desc' }
      });

      console.log('\n📋 Recently cleaned transactions:');
      cleanedTransactions.forEach(tx => {
        console.log(`  - ${tx.orderId} (${tx.status}) - cleaned at ${tx.updatedAt.toLocaleString()}`);
      });
    }

  } catch (error) {
    logger.error('Test failed', error as Error);
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();