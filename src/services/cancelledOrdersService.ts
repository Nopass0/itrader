/**
 * Сервис для определения и обработки отмененных ордеров на Bybit
 */

import { PrismaClient } from '../../generated/prisma';
import { createLogger } from '../logger';
import { BybitP2PManager } from './bybitP2PManager';
import type { P2POrder } from '../bybit/types/p2p';

const prisma = new PrismaClient();
const logger = createLogger('CancelledOrdersService');

export class CancelledOrdersService {
  private bybitManager: BybitP2PManager;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(bybitManager: BybitP2PManager) {
    this.bybitManager = bybitManager;
  }

  /**
   * Запуск сервиса проверки отмененных ордеров
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Service already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting cancelled orders monitoring service');

    // Проверяем сразу при запуске
    await this.checkCancelledOrders();

    // Запускаем периодическую проверку каждые 20 секунд
    this.checkInterval = setInterval(async () => {
      await this.checkCancelledOrders();
    }, 20 * 1000);
  }

  /**
   * Остановка сервиса
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Cancelled orders monitoring service stopped');
  }

  /**
   * Проверка отмененных ордеров
   */
  private async checkCancelledOrders() {
    try {
      logger.debug('Starting check for cancelled orders');

      // Получаем все активные транзакции с ордерами
      const activeTransactions = await prisma.transaction.findMany({
        where: {
          orderId: { not: null },
          status: {
            notIn: ['completed', 'failed', 'cancelled', 'cancelled_by_counterparty']
          }
        },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          }
        }
      });

      logger.info(`Found ${activeTransactions.length} active transactions to check`, {
        transactions: activeTransactions.map(t => ({
          id: t.id,
          orderId: t.orderId,
          status: t.status
        }))
      });

      for (const transaction of activeTransactions) {
        try {
          await this.checkTransactionOrder(transaction);
        } catch (error) {
          logger.error('Error checking transaction order', error, { 
            transactionId: transaction.id,
            orderId: transaction.orderId 
          });
        }
      }
    } catch (error) {
      logger.error('Error in checkCancelledOrders', error);
    }
  }

  /**
   * Проверка статуса ордера для конкретной транзакции
   */
  private async checkTransactionOrder(transaction: any) {
    if (!transaction.orderId || !transaction.advertisement?.bybitAccount) {
      logger.debug('Skipping transaction without orderId or bybitAccount', {
        transactionId: transaction.id,
        hasOrderId: !!transaction.orderId,
        hasAdvertisement: !!transaction.advertisement,
        hasBybitAccount: !!transaction.advertisement?.bybitAccount
      });
      return;
    }

    const accountId = transaction.advertisement.bybitAccount.accountId;
    
    logger.debug('Checking order status', {
      transactionId: transaction.id,
      orderId: transaction.orderId,
      accountId: accountId,
      currentStatus: transaction.status
    });
    
    try {
      // Получаем детали ордера с Bybit
      const orderDetails = await this.bybitManager.getOrderDetails(
        transaction.orderId,
        accountId
      );

      logger.debug('Order details received', {
        orderId: transaction.orderId,
        orderStatus: orderDetails?.status,
        orderExists: !!orderDetails
      });

      if (!orderDetails) {
        logger.warn('Order not found on Bybit', { 
          orderId: transaction.orderId,
          transactionId: transaction.id 
        });
        
        // Если ордер не найден, считаем его отмененным
        await this.markTransactionAsCancelled(transaction.id);
        return;
      }

      // Проверяем статус ордера (CANCELLED или числовой статус 50 = cancelled)
      if (orderDetails.status === 'CANCELLED' || orderDetails.status === 50 || orderDetails.status === '50') {
        logger.info('Found cancelled order', { 
          orderId: transaction.orderId,
          transactionId: transaction.id,
          orderStatus: orderDetails.status
        });
        
        await this.markTransactionAsCancelled(transaction.id);
      } else {
        logger.debug('Order is still active', {
          orderId: transaction.orderId,
          status: orderDetails.status
        });
      }
    } catch (error: any) {
      // Если ошибка 404 - ордер не найден, считаем отмененным
      if (error.response?.status === 404 || error.message?.includes('not found')) {
        logger.info('Order not found (404), marking as cancelled', { 
          orderId: transaction.orderId,
          transactionId: transaction.id 
        });
        
        await this.markTransactionAsCancelled(transaction.id);
      } else {
        throw error;
      }
    }
  }

  /**
   * Отметить транзакцию как отмененную
   */
  private async markTransactionAsCancelled(transactionId: string) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'cancelled_by_counterparty',
        failureReason: 'Order cancelled by counterparty',
        updatedAt: new Date()
      }
    });

    logger.info('Transaction marked as cancelled by counterparty', { transactionId });
  }

  /**
   * Пересоздать объявление для отмененной транзакции
   */
  async recreateAdvertisement(transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        advertisement: {
          include: {
            bybitAccount: true
          }
        },
        payout: true
      }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'cancelled_by_counterparty') {
      throw new Error('Transaction is not cancelled by counterparty');
    }

    if (!transaction.payout) {
      throw new Error('No payout found for transaction');
    }

    logger.info('Recreating advertisement for cancelled transaction', { 
      transactionId,
      payoutId: transaction.payout.id 
    });

    // Удаляем старую транзакцию и объявление из БД
    await prisma.$transaction(async (tx) => {
      // Удаляем сообщения чата
      await tx.chatMessage.deleteMany({
        where: { transactionId }
      });

      // Удаляем транзакцию
      await tx.transaction.delete({
        where: { id: transactionId }
      });

      // Удаляем объявление
      if (transaction.advertisementId) {
        await tx.advertisement.delete({
          where: { id: transaction.advertisementId }
        });
      }

      // Обновляем статус выплаты обратно на "принято" (status 5)
      await tx.payout.update({
        where: { id: transaction.payout.id },
        data: {
          status: 5, // Статус "принято" - готово для создания объявления
          updatedAt: new Date()
        }
      });
    });

    logger.info('Successfully cleaned up cancelled transaction and reset payout status', { 
      transactionId,
      payoutId: transaction.payout.id 
    });
  }

  /**
   * Получить все транзакции, отмененные контрагентом
   */
  async getCancelledTransactions() {
    return await prisma.transaction.findMany({
      where: {
        status: 'cancelled_by_counterparty'
      },
      include: {
        advertisement: {
          include: {
            bybitAccount: true
          }
        },
        payout: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
  }
}