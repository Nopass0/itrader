/**
 * Cancelled Order Detector Service
 * Monitors chat messages for order cancellation notifications
 */

import { db } from "../db";
import { createLogger } from "../logger";
import { BybitP2PManagerService } from "./bybitP2PManager";

const logger = createLogger("CancelledOrderDetector");

export class CancelledOrderDetectorService {
  private bybitManager: BybitP2PManagerService;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  // Cancellation message patterns
  private cancellationPatterns = [
    "Your order has been canceled. The seller is not allowed to appeal after the order is canceled.",
    "Ваш заказ был отменен",
    "Your order has been cancelled",
    "Order cancelled",
    "Заказ отменен",
    "订单已取消"
  ];

  constructor(bybitManager: BybitP2PManagerService) {
    this.bybitManager = bybitManager;
  }

  /**
   * Start monitoring for cancelled orders
   */
  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      logger.info("Service already running");
      return;
    }

    logger.info("🚀 Starting Cancelled Order Detector Service", {
      interval: intervalMs
    });

    this.isRunning = true;

    // Run first check immediately
    await this.checkForCancelledOrders();

    // Set up interval
    this.checkInterval = setInterval(async () => {
      await this.checkForCancelledOrders();
    }, intervalMs);

    logger.info("✅ Cancelled Order Detector Service started");
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info("🛑 Cancelled Order Detector Service stopped");
  }

  /**
   * Check all active transactions for cancellation messages
   */
  private async checkForCancelledOrders(): Promise<void> {
    try {
      // Get all non-completed and non-cancelled transactions with orders
      const transactions = await db.prisma.transaction.findMany({
        where: {
          orderId: { not: null },
          status: {
            notIn: ["completed", "cancelled", "failed", "stupid"]
          }
        },
        include: {
          advertisement: {
            include: {
              bybitAccount: true
            }
          },
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 50 // Check last 50 messages
          }
        }
      });

      logger.debug(`Checking ${transactions.length} active transactions for cancellations`);

      for (const transaction of transactions) {
        if (!transaction.orderId || !transaction.advertisement?.bybitAccount) continue;

        try {
          // Check existing messages in database first
          const cancelledInDb = this.checkMessagesForCancellation(transaction.chatMessages);
          
          if (cancelledInDb) {
            await this.markTransactionCancelled(transaction.id, "Order cancelled (detected from DB messages)");
            continue;
          }

          // Get fresh messages from Bybit API
          const client = this.bybitManager.getClient(transaction.advertisement.bybitAccount.accountId);
          if (!client) continue;

          const chatResponse = await client.getChatMessages(transaction.orderId, 1, 50);
          
          let messages = [];
          if (Array.isArray(chatResponse)) {
            messages = chatResponse;
          } else if (chatResponse && chatResponse.list) {
            messages = chatResponse.list;
          } else if (chatResponse && chatResponse.result) {
            messages = chatResponse.result;
          }

          // Check for cancellation messages
          for (const msg of messages) {
            if (this.isCancellationMessage(msg.message || msg.content || '')) {
              logger.warn("🚫 Order cancellation detected!", {
                transactionId: transaction.id,
                orderId: transaction.orderId,
                message: msg.message,
                messageId: msg.id
              });

              await this.markTransactionCancelled(transaction.id, msg.message || "Order cancelled");
              break;
            }
          }

        } catch (error) {
          logger.error("Error checking transaction for cancellation", error as Error, {
            transactionId: transaction.id,
            orderId: transaction.orderId
          });
        }
      }
    } catch (error) {
      logger.error("Error in checkForCancelledOrders", error as Error);
    }
  }

  /**
   * Check if messages contain cancellation notification
   */
  private checkMessagesForCancellation(messages: any[]): boolean {
    for (const msg of messages) {
      const content = msg.message || msg.content || '';
      if (this.isCancellationMessage(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a message indicates order cancellation
   */
  private isCancellationMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.cancellationPatterns.some(pattern => 
      lowerMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * Mark transaction as cancelled
   */
  private async markTransactionCancelled(transactionId: string, reason: string): Promise<void> {
    try {
      await db.updateTransaction(transactionId, {
        status: "cancelled",
        failureReason: reason,
        cancelledAt: new Date()
      });

      logger.info("✅ Transaction marked as cancelled", {
        transactionId,
        reason
      });

      // Emit event for other services
      this.bybitManager.emit('transaction:cancelled', {
        transactionId,
        reason
      });

    } catch (error) {
      logger.error("Error marking transaction as cancelled", error as Error, {
        transactionId
      });
    }
  }
}