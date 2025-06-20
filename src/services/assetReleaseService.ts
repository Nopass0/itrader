import { PrismaClient } from '../../generated/prisma';
import { GateAccountManager } from '../gate/accountManager';
import { createLogger } from '../logger';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const logger = createLogger('AssetReleaseService');

export class AssetReleaseService {
  private manager: GateAccountManager | null = null;
  private gateAccount: any = null;
  private isInitialized = false;
  private bybitManager: any = null;

  constructor(bybitManager?: any) {
    this.bybitManager = bybitManager;
  }

  /**
   * Initialize the service and Gate account manager
   */
  private async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Get active Gate account
      this.gateAccount = await prisma.gateAccount.findFirst({
        where: { isActive: true }
      });

      if (!this.gateAccount || !this.gateAccount.accountId) {
        logger.warn('No active Gate account found');
        return false;
      }

      // Check if cookies exist
      const cookiesPath = path.join('data/cookies', `${this.gateAccount.accountId}.json`);
      if (!fs.existsSync(cookiesPath)) {
        logger.warn('No cookies for Gate account', {
          accountId: this.gateAccount.accountId
        });
        return false;
      }

      // Initialize manager
      this.manager = new GateAccountManager({
        cookiesDir: './data/cookies',
        autoSaveCookies: true
      });

      await this.manager.initialize();

      // Add account (it will load cookies automatically)
      const loginResult = await this.manager.addAccount(
        this.gateAccount.email,
        '', // No password, will use cookies
        false, // Don't auto login
        this.gateAccount.accountId
      );

      if (!loginResult) {
        logger.warn('Failed to load Gate account from cookies');
        return false;
      }

      // Check authentication
      const isAuth = await this.manager.isAuthenticated(this.gateAccount.email);
      if (!isAuth) {
        logger.warn('Gate session expired');
        return false;
      }

      this.isInitialized = true;
      logger.info('AssetReleaseService initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize AssetReleaseService', error);
      return false;
    }
  }

  /**
   * Approve a single transaction with receipt
   */
  async approveTransaction(gatePayoutId: number, receiptPath: string): Promise<boolean> {
    try {
      if (!await this.initialize()) {
        return false;
      }

      logger.info('Approving transaction', {
        gatePayoutId,
        receiptPath
      });

      const result = await this.manager!.approveTransactionWithReceipt(
        this.gateAccount.email,
        gatePayoutId.toString(),
        receiptPath
      );

      logger.info('✅ Transaction approved in Gate', {
        gatePayoutId,
        status: result.status,
        statusLabel: result.statusLabel
      });

      return true;
    } catch (error: any) {
      if (error.message?.includes('already')) {
        logger.info('Transaction already approved', { gatePayoutId });
        return true;
      }
      
      logger.error('Failed to approve transaction', error, {
        gatePayoutId,
        message: error.message
      });
      return false;
    }
  }

  /**
   * Check and release assets for transactions with receipts
   */
  async checkAndReleaseAssets(): Promise<void> {
    try {
      logger.info('Starting asset release check...');

      // Find transactions that need approval
      const transactions = await prisma.transaction.findMany({
        where: {
          status: {
            in: ['payment_confirmed', 'receipt_received']
          },
          receiptReceivedAt: {
            not: null
          },
          payout: {
            status: {
              in: [5, 7] // Waiting confirmation or processing
            },
            gatePayoutId: {
              not: null
            }
          }
        },
        include: {
          payout: true,
          tinkoffReceipt: true
        }
      });

      logger.info(`Found ${transactions.length} transactions pending approval`);

      if (transactions.length === 0) {
        return;
      }

      if (!await this.initialize()) {
        logger.error('Failed to initialize Gate connection');
        return;
      }

      // Process each transaction
      for (const transaction of transactions) {
        try {
          const payout = transaction.payout;
          if (!payout || !payout.gatePayoutId) {
            continue;
          }

          logger.info('Processing transaction', {
            transactionId: transaction.id,
            gatePayoutId: payout.gatePayoutId,
            status: transaction.status
          });

          // Find receipt file
          let receiptPath: string | null = null;

          // Check if we have a linked receipt
          const receipt = await prisma.receipt.findFirst({
            where: {
              payoutId: payout.id,
              filePath: { not: null }
            }
          });

          if (receipt && receipt.filePath) {
            receiptPath = path.join(process.cwd(), receipt.filePath);
          } else if (transaction.tinkoffReceipt?.pdfPath) {
            receiptPath = path.join(process.cwd(), transaction.tinkoffReceipt.pdfPath);
          }

          if (!receiptPath || !fs.existsSync(receiptPath)) {
            logger.warn('No receipt file found for transaction', {
              transactionId: transaction.id
            });
            continue;
          }

          // Approve transaction
          const approved = await this.approveTransaction(
            payout.gatePayoutId,
            receiptPath
          );

          if (approved) {
            // Update transaction status to release_money
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: 'release_money',
                approvedAt: new Date()
              }
            });

            // Update payout status
            await prisma.payout.update({
              where: { id: payout.id },
              data: {
                status: 7, // Approved
                approvedAt: new Date()
              }
            });

            logger.info('✅ Transaction approved, waiting for money release', {
              transactionId: transaction.id,
              gatePayoutId: payout.gatePayoutId,
              status: 'release_money'
            });

            // Send promotional message after successful approval
            await this.sendPromotionalMessage(transaction.id);
          }

        } catch (error) {
          logger.error('Error processing transaction', error, {
            transactionId: transaction.id
          });
        }
      }

      logger.info('Asset release check completed');
    } catch (error) {
      logger.error('Error in checkAndReleaseAssets', error);
    }
  }

  /**
   * Approve transaction when receipt is matched
   */
  async approveTransactionWithReceipt(
    transactionId: string,
    payoutId: string,
    receiptPath: string
  ): Promise<boolean> {
    try {
      // Get payout details
      const payout = await prisma.payout.findUnique({
        where: { id: payoutId }
      });

      if (!payout || !payout.gatePayoutId) {
        logger.warn('Payout not found or no Gate ID', { payoutId });
        return false;
      }

      // Approve in Gate
      const approved = await this.approveTransaction(
        payout.gatePayoutId,
        receiptPath
      );

      if (approved) {
        // Update transaction to release_money status
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: 'release_money',
            approvedAt: new Date()
          }
        });

        // Update payout
        await prisma.payout.update({
          where: { id: payoutId },
          data: {
            status: 7,
            approvedAt: new Date()
          }
        });

        logger.info('✅ Transaction approved, set to release_money', {
          transactionId,
          gatePayoutId: payout.gatePayoutId,
          status: 'release_money'
        });

        // Send promotional message after successful approval
        await this.sendPromotionalMessage(transactionId);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error approving transaction with receipt', error, {
        transactionId,
        payoutId
      });
      return false;
    }
  }

  /**
   * Send promotional message after successful approval
   */
  private async sendPromotionalMessage(transactionId: string): Promise<void> {
    try {
      // Get transaction with order details
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!transaction || !transaction.orderId) {
        logger.warn('Transaction not found or no orderId', { transactionId });
        return;
      }

      // Import necessary services
      const { ChatAutomationService } = await import('./chatAutomation');
      
      // Get active Bybit account
      const activeAccount = await prisma.bybitAccount.findFirst({
        where: { isActive: true }
      });

      if (!activeAccount) {
        logger.warn('No active Bybit account for sending message');
        return;
      }

      // Use the shared bybitManager if available
      if (!this.bybitManager) {
        logger.warn('No bybitManager provided, cannot send promotional message');
        return;
      }

      const chatService = new ChatAutomationService(this.bybitManager);

      // Prepare promotional message
      const promotionalMessage = `Переходи в закрытый чат https://t.me/+nIB6kP22KmhlMmQy

Всегда есть большой объем ЮСДТ по хорошему курсу, работаем оперативно.`;

      // Send message
      await chatService.sendMessage(
        transactionId,
        promotionalMessage
      );

      logger.info('📢 Promotional message sent', {
        transactionId,
        orderId: transaction.orderId
      });

    } catch (error) {
      logger.error('Error sending promotional message', error, {
        transactionId
      });
    }
  }
}

// Export singleton instance
let assetReleaseService: AssetReleaseService | null = null;

export function getAssetReleaseService(bybitManager?: any): AssetReleaseService {
  if (!assetReleaseService) {
    assetReleaseService = new AssetReleaseService(bybitManager);
  }
  return assetReleaseService;
}