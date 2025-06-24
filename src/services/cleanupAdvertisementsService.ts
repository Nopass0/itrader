/**
 * Сервис для очистки объявлений у отмененных транзакций
 * Удаляет объявления у транзакций со статусами: cancelled, cancelled_by_counterparty, failed, stupid
 */

import { PrismaClient } from '../../generated/prisma';
import { createLogger } from '../logger';
import { BybitP2PManagerService } from './bybitP2PManager';

const prisma = new PrismaClient();
const logger = createLogger('CleanupAdvertisementsService');

export class CleanupAdvertisementsService {
  private bybitManager: BybitP2PManagerService;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(bybitManager: BybitP2PManagerService) {
    this.bybitManager = bybitManager;
  }

  /**
   * Запуск сервиса
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting cleanup advertisements service');

    // Запускаем первую очистку сразу
    await this.cleanupAdvertisements();

    // Запускаем периодическую очистку каждые 10 секунд
    this.intervalId = setInterval(async () => {
      await this.cleanupAdvertisements();
    }, 10 * 1000);
  }

  /**
   * Остановка сервиса
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('Service is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping cleanup advertisements service');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Основная функция очистки объявлений
   */
  private async cleanupAdvertisements() {
    try {
      logger.info('Starting advertisements cleanup');

      // Статусы транзакций, у которых нужно удалить объявления
      const statuses = ['cancelled', 'cancelled_by_counterparty', 'failed', 'stupid'];

      // Находим все транзакции с указанными статусами и существующими объявлениями
      const transactions = await prisma.transaction.findMany({
        where: {
          status: { in: statuses },
          advertisementId: { not: null }
        },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          }
        }
      });

      logger.info(`Found ${transactions.length} transactions with advertisements to clean up`);

      let deletedCount = 0;
      let failedCount = 0;

      for (const transaction of transactions) {
        try {
          // Пытаемся удалить объявление на Bybit
          if (transaction.advertisement?.bybitAdId && transaction.advertisement?.bybitAccount) {
            try {
              const client = this.bybitManager.getClient(transaction.advertisement.bybitAccount.accountId);
              if (client) {
                await client.deleteAdvertisement(transaction.advertisement.bybitAdId);
                logger.info('Deleted advertisement from Bybit', {
                  bybitAdId: transaction.advertisement.bybitAdId,
                  transactionId: transaction.id,
                  status: transaction.status
                });
              }
            } catch (error) {
              logger.warn('Failed to delete advertisement from Bybit', error as Error, {
                bybitAdId: transaction.advertisement?.bybitAdId,
                transactionId: transaction.id,
                status: transaction.status
              });
              // Продолжаем удаление из БД даже если не удалось удалить на Bybit
            }
          }

          // Удаляем объявление из БД
          if (transaction.advertisementId) {
            // Сначала обновляем транзакцию, убирая ссылку на объявление
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { advertisementId: null }
            });

            // Затем удаляем объявление
            await prisma.advertisement.delete({
              where: { id: transaction.advertisementId }
            });
            
            logger.info('Deleted advertisement from database', {
              advertisementId: transaction.advertisementId,
              transactionId: transaction.id,
              status: transaction.status
            });
            
            deletedCount++;
          }
        } catch (error) {
          logger.error('Failed to cleanup advertisement', error as Error, {
            transactionId: transaction.id,
            advertisementId: transaction.advertisementId,
            status: transaction.status
          });
          failedCount++;
        }
      }

      logger.info('Advertisements cleanup completed', {
        total: transactions.length,
        deleted: deletedCount,
        failed: failedCount
      });

    } catch (error) {
      logger.error('Error during advertisements cleanup', error as Error);
    }
  }

  /**
   * Принудительная очистка (для ручного запуска)
   */
  async forceCleanup() {
    logger.info('Force cleanup requested');
    await this.cleanupAdvertisements();
  }

  /**
   * Очистка объявлений для конкретной транзакции
   */
  async cleanupSingleTransaction(transactionId: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          }
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const allowedStatuses = ['cancelled', 'cancelled_by_counterparty', 'failed', 'stupid'];
      if (!allowedStatuses.includes(transaction.status)) {
        throw new Error(`Transaction status '${transaction.status}' is not allowed for cleanup`);
      }

      if (!transaction.advertisementId) {
        logger.warn('Transaction has no advertisement to cleanup', { transactionId });
        return;
      }

      // Удаляем объявление на Bybit
      if (transaction.advertisement?.bybitAdId && transaction.advertisement?.bybitAccount) {
        try {
          const client = this.bybitManager.getClient(transaction.advertisement.bybitAccount.accountId);
          if (client) {
            await client.deleteAdvertisement(transaction.advertisement.bybitAdId);
            logger.info('Deleted advertisement from Bybit', {
              bybitAdId: transaction.advertisement.bybitAdId,
              transactionId
            });
          }
        } catch (error) {
          logger.warn('Failed to delete advertisement from Bybit', error as Error, {
            bybitAdId: transaction.advertisement?.bybitAdId,
            transactionId
          });
        }
      }

      // Сначала обновляем транзакцию, убирая ссылку на объявление
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { advertisementId: null }
      });

      // Затем удаляем объявление из БД
      await prisma.advertisement.delete({
        where: { id: transaction.advertisementId }
      });

      logger.info('Successfully cleaned up advertisement for transaction', {
        transactionId,
        advertisementId: transaction.advertisementId
      });

    } catch (error) {
      logger.error('Failed to cleanup single transaction', error as Error, { transactionId });
      throw error;
    }
  }
}