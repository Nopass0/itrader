/**
 * Service to sync Bybit orders with appeal status to our database
 */

import { PrismaClient } from '../../generated/prisma';
import { createLogger } from '../logger';
import type { BybitP2PManager } from './bybitP2PManager';

const logger = createLogger('BybitAppealSyncService');
const prisma = new PrismaClient();

export class BybitAppealSyncService {
  private bybitManager: BybitP2PManager;
  private isRunning: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(bybitManager: BybitP2PManager) {
    this.bybitManager = bybitManager;
  }

  /**
   * Start syncing appeal orders
   */
  start(intervalMs: number = 60000) { // Check every minute
    if (this.isRunning) {
      logger.warn('Appeal sync service already running');
      return;
    }

    logger.info('Starting Bybit appeal sync service', { interval: intervalMs });
    this.isRunning = true;

    // Run immediately
    this.syncAppealOrders();

    // Schedule periodic runs
    this.syncInterval = setInterval(() => {
      this.syncAppealOrders();
    }, intervalMs);
  }

  /**
   * Stop syncing
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    logger.info('Stopped Bybit appeal sync service');
  }

  /**
   * Sync orders with appeal status from Bybit
   */
  private async syncAppealOrders() {
    try {
      logger.debug('Starting appeal orders sync');
      
      const accountIds = this.bybitManager.getAccounts();
      let totalAppeals = 0;
      let updatedTransactions = 0;

      for (const accountId of accountIds) {
        try {
          const client = this.bybitManager.getClient(accountId);
          if (!client) {
            logger.warn(`No client found for account ${accountId}`);
            continue;
          }

          // Get orders with status 30 (appealing) from Bybit
          const response = await client.getOrdersSimplified({
            page: 1,
            size: 100,
            status: 30 // Appeal status
          });

          if (response.items && response.items.length > 0) {
            logger.info(`Found ${response.items.length} appeal orders for account ${accountId}`);
            totalAppeals += response.items.length;

            // Process each appeal order
            for (const order of response.items) {
              try {
                // Find matching transaction in our database by orderId
                const transaction = await prisma.transaction.findFirst({
                  where: {
                    orderId: order.id,
                    advertisement: {
                      bybitAccountId: accountId
                    }
                  }
                });

                if (transaction) {
                  // Update transaction status to appeal if it's not already
                  if (transaction.status !== 'appeal') {
                    await prisma.transaction.update({
                      where: { id: transaction.id },
                      data: {
                        status: 'appeal',
                        updatedAt: new Date()
                      }
                    });

                    logger.info('Updated transaction to appeal status', {
                      transactionId: transaction.id,
                      orderId: order.id,
                      accountId,
                      previousStatus: transaction.status
                    });

                    updatedTransactions++;

                    // Emit socket event for real-time update
                    const { getGlobalIO } = require('../webserver/global');
                    const io = getGlobalIO();
                    if (io) {
                      io.emit('transaction:updated', {
                        id: transaction.id,
                        transaction: {
                          ...transaction,
                          status: 'appeal'
                        }
                      });
                    }
                  }
                } else {
                  logger.warn('No matching transaction found for appeal order', {
                    orderId: order.id,
                    accountId
                  });
                }
              } catch (error) {
                logger.error('Error processing appeal order', error as Error, {
                  orderId: order.id,
                  accountId
                });
              }
            }
          }
        } catch (error) {
          logger.error(`Error fetching appeal orders for account ${accountId}`, error as Error);
        }
      }

      if (totalAppeals > 0) {
        logger.info('Appeal sync completed', {
          totalAppeals,
          updatedTransactions,
          accounts: accountIds.length
        });
      }
    } catch (error) {
      logger.error('Error in appeal sync', error as Error);
    }
  }

  /**
   * Manually trigger sync
   */
  async syncNow(): Promise<{ totalAppeals: number; updatedTransactions: number }> {
    logger.info('Manual appeal sync triggered');
    
    const accountIds = this.bybitManager.getAccounts();
    let totalAppeals = 0;
    let updatedTransactions = 0;

    for (const accountId of accountIds) {
      try {
        const client = this.bybitManager.getClient(accountId);
        if (!client) continue;

        const response = await client.getOrdersSimplified({
          page: 1,
          size: 100,
          status: 30
        });

        if (response.items) {
          totalAppeals += response.items.length;

          for (const order of response.items) {
            const transaction = await prisma.transaction.findFirst({
              where: {
                orderId: order.id,
                advertisement: {
                  bybitAccountId: accountId
                }
              }
            });

            if (transaction && transaction.status !== 'appeal') {
              await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'appeal' }
              });
              updatedTransactions++;
            }
          }
        }
      } catch (error) {
        logger.error(`Error in manual sync for account ${accountId}`, error as Error);
      }
    }

    return { totalAppeals, updatedTransactions };
  }
}