import { PrismaClient } from '../../generated/prisma';
import { createLogger } from '../logger';

const prisma = new PrismaClient();
const logger = createLogger('MoneyReleaseService');

export class MoneyReleaseService {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private bybitManager: any = null;

  constructor(bybitManager?: any) {
    this.bybitManager = bybitManager;
  }

  /**
   * Start monitoring transactions for money release
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MoneyReleaseService already running');
      return;
    }

    try {
      // Check if we have a bybitManager
      if (!this.bybitManager) {
        logger.error('No BybitManager provided to MoneyReleaseService');
        return;
      }
      
      // Check if bybitManager is initialized
      const activeAccount = await prisma.bybitAccount.findFirst({
        where: { isActive: true }
      });

      if (!activeAccount) {
        logger.error('No active Bybit account found');
        return;
      }

      this.isRunning = true;
      logger.info('MoneyReleaseService started');
      console.log('[MoneyReleaseService] ✅ Started - checking every 2 seconds');

      // Start periodic check every 2 seconds
      this.checkInterval = setInterval(() => {
        this.checkAndReleaseAssets();
      }, 2000);

      // Run first check immediately
      await this.checkAndReleaseAssets();
    } catch (error) {
      logger.error('Failed to start MoneyReleaseService', error);
      this.isRunning = false;
    }
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('MoneyReleaseService stopped');
  }

  /**
   * Check and release assets for transactions
   */
  private async checkAndReleaseAssets(): Promise<void> {
    try {
      // Log that we're checking
      const checkTime = new Date();
      if (checkTime.getSeconds() % 10 === 0) { // Log every 10 seconds
        console.log('[MoneyReleaseService] Checking for transactions to release...');
      }
      // Find transactions with release_money status
      const transactions = await prisma.transaction.findMany({
        where: {
          status: 'release_money',
          approvedAt: {
            not: null
          }
        },
        include: {
          payout: true
        }
      });

      if (transactions.length === 0) {
        // Log periodically to show service is running
        const now = new Date();
        if (now.getSeconds() % 30 === 0) { // Log every 30 seconds
          logger.debug('[MoneyReleaseService] No transactions in release_money status. Service is running...');
        }
        return;
      }

      logger.info(`Found ${transactions.length} transactions to check for release`);
      console.log(`[MoneyReleaseService] Found ${transactions.length} transactions in release_money status`);

      const now = new Date();

      for (const transaction of transactions) {
        try {
          if (!transaction.approvedAt || !transaction.orderId) {
            continue;
          }

          // Check if 2 minutes have passed since approval
          const timeSinceApproval = now.getTime() - transaction.approvedAt.getTime();
          const minutesSinceApproval = timeSinceApproval / (1000 * 60);

          if (minutesSinceApproval < 2) {
            logger.debug('Transaction not ready for release yet', {
              transactionId: transaction.id,
              minutesSinceApproval: minutesSinceApproval.toFixed(2)
            });
            continue;
          }

          logger.info('Releasing assets for transaction', {
            transactionId: transaction.id,
            orderId: transaction.orderId,
            minutesSinceApproval: minutesSinceApproval.toFixed(2)
          });
          console.log(`[MoneyReleaseService] 🚀 Releasing assets for order ${transaction.orderId} (${minutesSinceApproval.toFixed(2)} minutes since approval)`);

          // Release assets via Bybit API
          const released = await this.releaseAssets(transaction.orderId);

          if (released) {
            // Update transaction status to completed
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: 'completed',
                completedAt: new Date()
              }
            });

            // Order status will be updated by Bybit automatically

            logger.info('✅ Assets released successfully', {
              transactionId: transaction.id,
              orderId: transaction.orderId
            });
            console.log(`[MoneyReleaseService] ✅ Assets released successfully for order ${transaction.orderId}`);
          }

        } catch (error) {
          logger.error('Error processing transaction', error, {
            transactionId: transaction.id
          });
        }
      }
    } catch (error) {
      logger.error('Error in checkAndReleaseAssets', error);
    }
  }

  /**
   * Release assets for an order via Bybit API
   */
  private async releaseAssets(orderId: string): Promise<boolean> {
    try {
      if (!this.bybitManager) {
        logger.error('Bybit Manager not initialized');
        return false;
      }

      // Get active account ID
      const activeAccount = await prisma.bybitAccount.findFirst({
        where: { isActive: true }
      });

      if (!activeAccount) {
        logger.error('No active Bybit account found');
        return false;
      }

      const client = this.bybitManager.getClient(activeAccount.accountId);
      if (!client) {
        logger.error('Failed to get Bybit client');
        return false;
      }
      
      logger.info('Calling Bybit finish order API', { orderId });

      await client.releaseAssets(orderId);
      
      logger.info('✅ Bybit API: Order finished successfully', {
        orderId
      });
      return true;
    } catch (error: any) {
      if (error.message?.includes('Order is not in progress')) {
        logger.info('Order already finished', { orderId });
        return true;
      }
      
      logger.error('Failed to release assets', error, {
        orderId,
        message: error.message
      });
      return false;
    }
  }
}

// Export singleton instance
let moneyReleaseService: MoneyReleaseService | null = null;

export function getMoneyReleaseService(bybitManager?: any): MoneyReleaseService {
  if (!moneyReleaseService) {
    moneyReleaseService = new MoneyReleaseService(bybitManager);
  }
  return moneyReleaseService;
}