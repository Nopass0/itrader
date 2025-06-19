/**
 * Сервис обработки P2P ордеров Bybit
 */

import { EventEmitter } from 'events';
import { PrismaClient } from "../../generated/prisma";
import { BybitP2PManagerService } from './bybitP2PManager';
import { ChatAutomationService } from './chatAutomation';
import { createLogger } from '../logger';

const logger = createLogger('P2POrderProcessor');
const prisma = new PrismaClient();

interface OrderProcessorConfig {
  pollingInterval?: number; // Интервал опроса ордеров (мс)
  maxRetries?: number;
  retryDelay?: number;
}

interface P2POrder {
  id: string;
  side: number; // 0: Buy, 1: Sell
  tokenId: string;
  orderType: string;
  amount: string;
  currencyId: string;
  price: string;
  fee: string;
  targetNickName: string;
  targetUserId: string;
  status: number;
  createDate: string;
  transferLastSeconds: string;
  sellerRealName: string;
  buyerRealName: string;
}

type OrderStatus = 
  | 'CREATED'      // Order just created
  | 'PAID'         // Buyer marked as paid
  | 'RELEASED'     // Seller released crypto
  | 'COMPLETED'    // Order completed
  | 'CANCELLED'    // Order cancelled
  | 'APPEALING';   // Order in dispute

interface OrderEvent {
  type: 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | 'ORDER_COMPLETED' | 'ORDER_FAILED';
  orderId: string;
  advertisementId?: string;
  status?: OrderStatus;
  data?: any;
}

export class P2POrderProcessor extends EventEmitter {
  private config: Required<OrderProcessorConfig>;
  private intervalId?: NodeJS.Timeout;
  public isRunning = false;
  private processedOrders = new Set<string>();
  private orderMonitors = new Map<string, NodeJS.Timeout>();

  constructor(
    private bybitManager: BybitP2PManagerService,
    private chatService: ChatAutomationService,
    config: OrderProcessorConfig = {}
  ) {
    super();
    
    this.config = {
      pollingInterval: config.pollingInterval || 10000, // 10 seconds
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000
    };

    // Listen to chat service events
    this.chatService.on('chatMessage', this.handleChatMessage.bind(this));
  }

  /**
   * Start monitoring for new orders
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting order monitoring...');

    // Start polling
    this.intervalId = setInterval(() => {
      this.checkPendingOrders().catch(error => {
        logger.error('Error checking orders:', error);
      });
    }, this.config.pollingInterval);

    // Initial check
    await this.checkPendingOrders();
    
    // Resume chat polling for existing transactions with orders
    await this.resumeExistingChats();
  }

  /**
   * Resume chat polling for existing transactions
   */
  private async resumeExistingChats(): Promise<void> {
    try {
      // Get all active transactions with orders
      const activeTransactions = await prisma.transaction.findMany({
        where: {
          orderId: { not: null },
          status: {
            in: ['chat_started', 'waiting_payment', 'payment_received']
          }
        },
        include: {
          advertisement: true
        }
      });

      logger.info(`Found ${activeTransactions.length} active transactions to resume chat polling`);

      for (const transaction of activeTransactions) {
        if (transaction.orderId) {
          try {
            logger.info(`Resuming chat polling for order ${transaction.orderId}, transaction ${transaction.id}`);
            await this.bybitManager.startChatPolling(transaction.id);
            
            // Also add to processed orders to avoid re-processing
            this.processedOrders.add(transaction.orderId);
            
            // Start order monitoring
            this.startOrderMonitoring(
              transaction.orderId, 
              transaction.id, 
              transaction.advertisement.bybitAccountId
            );
          } catch (error) {
            logger.error(`Error resuming chat for transaction ${transaction.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error resuming existing chats:', error);
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Clear all order monitors
    for (const [orderId, timeout] of this.orderMonitors) {
      clearTimeout(timeout);
    }
    this.orderMonitors.clear();

    this.isRunning = false;
    logger.info('Stopped');
  }

  /**
   * Check for pending orders
   */
  private async checkPendingOrders(): Promise<void> {
    try {
      const accounts = await this.bybitManager.getActiveAccounts();
      
      for (const account of accounts) {
        try {
          await this.checkAccountOrders(account.accountId);
        } catch (error) {
          logger.error(`Error checking account ${account.accountId}:`, error);
        }
      }
      
      // Also check for orders that might have been created but not processed
      await this.checkExistingOrdersWithoutChat();
    } catch (error) {
      logger.error('Error in checkPendingOrders:', error);
    }
  }
  
  /**
   * Check for existing orders without chat messages
   */
  private async checkExistingOrdersWithoutChat(): Promise<void> {
    try {
      const transactionsWithOrders = await prisma.transaction.findMany({
        where: {
          orderId: { not: null },
          status: {
            in: ['pending', 'chat_started', 'waiting_payment']
          }
        },
        include: {
          chatMessages: true,
          advertisement: true
        }
      });

      for (const transaction of transactionsWithOrders) {
        const hasOurMessages = transaction.chatMessages.some(msg => msg.sender === 'us');
        
        if (!hasOurMessages && transaction.orderId) {
          logger.info(`Found order ${transaction.orderId} without our messages, initiating chat`);
          
          try {
            // Update status if needed
            if (transaction.status === 'pending') {
              await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'chat_started' }
              });
            }
            
            // Start chat automation
            await this.chatService.startAutomation(transaction.id);
            
            // Start chat polling
            await this.bybitManager.startChatPolling(transaction.id);
            
            // Add to processed orders
            this.processedOrders.add(transaction.orderId);
            
          } catch (error) {
            logger.error(`Error initiating chat for order ${transaction.orderId}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error checking existing orders:', error);
    }
  }

  /**
   * Check orders for specific account
   */
  private async checkAccountOrders(accountId: string): Promise<void> {
    const client = this.bybitManager.getClient(accountId);
    if (!client) {
      return;
    }

    try {
      // Try multiple methods to get orders
      let orders: P2POrder[] = [];
      
      try {
        // Method 1: Get all orders
        const allOrdersResponse = await client.getOrders(undefined, 1, 100);
        if (allOrdersResponse.list && allOrdersResponse.list.length > 0) {
          orders.push(...allOrdersResponse.list);
          logger.info(`Method 1: Found ${allOrdersResponse.list.length} orders`);
        }
      } catch (error) {
        logger.error('Method 1 failed:', error);
      }
      
      try {
        // Method 2: Get pending orders
        const pendingResponse = await client.getPendingOrders(1, 100);
        if (pendingResponse.list && pendingResponse.list.length > 0) {
          orders.push(...pendingResponse.list);
          logger.info(`Method 2: Found ${pendingResponse.list.length} pending orders`);
        }
      } catch (error) {
        logger.error('Method 2 failed:', error);
      }
      
      // Remove duplicates
      const uniqueOrdersMap = new Map(orders.map(order => [order.id, order]));
      const uniqueOrders = Array.from(uniqueOrdersMap.values());
      
      // Filter only active orders (status 10 or 20)
      const activeOrders = uniqueOrders.filter(order => 
        order.status === 10 || order.status === 20
      );
      
      logger.info(`Found ${uniqueOrders.length} total unique orders, ${activeOrders.length} active`);
      
      for (const order of activeOrders) {
        if (!this.processedOrders.has(order.id)) {
          logger.info(`Processing order ${order.id} with status ${order.status}`);
          await this.processNewOrder(order, accountId);
        }
      }
      
      // Also sync chat messages for existing orders
      for (const order of activeOrders) {
        await this.syncChatMessages(order.id, accountId);
      }
    } catch (error) {
      logger.error(`Error fetching orders for ${accountId}:`, error);
    }
  }

  /**
   * Process newly discovered order
   */
  private async processNewOrder(order: P2POrder, bybitAccountId: string): Promise<void> {
    try {
      logger.info(`New order discovered: ${order.id}`);
      this.processedOrders.add(order.id);

      // Get order details
      const orderDetails = await this.getOrderDetails(order.id, bybitAccountId);
      if (!orderDetails) {
        logger.error(`Failed to get details for order ${order.id}`);
        return;
      }

      // Find matching transaction by advertisement ID
      const advertisementId = orderDetails.itemId;
      const transaction = await prisma.transaction.findFirst({
        where: {
          advertisement: {
            bybitAdId: advertisementId
          }
        },
        include: {
          advertisement: true,
          payout: true
        }
      });

      if (!transaction) {
        logger.error(`No transaction found for advertisement ${advertisementId}`);
        return;
      }

      // Verify amount matches
      const orderAmount = parseFloat(order.amount || "0");
      if (transaction.payout) {
        const payoutData = typeof transaction.payout.amountTrader === "string" 
          ? JSON.parse(transaction.payout.amountTrader) 
          : transaction.payout.amountTrader;
        const payoutAmount = payoutData?.["643"] || 0;
        
        if (Math.abs(payoutAmount - orderAmount) > 1) {
          logger.error("⚠️ CRITICAL: Amount mismatch in p2pOrderProcessor!", {
            orderId: order.id,
            orderAmount,
            payoutAmount,
            payoutId: transaction.payoutId,
            transactionId: transaction.id,
          });
          // Continue but log the error
        } else {
          logger.info("✅ Amount verification passed", {
            orderId: order.id,
            amount: orderAmount,
          });
        }
      }

      // Update transaction with order ID
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          orderId: order.id,
          status: 'chat_started'
        }
      });

      logger.info(`Linked order ${order.id} to transaction ${transaction.id}`);

      // Delete the advertisement
      if (transaction.advertisement) {
        try {
          await this.deleteAdvertisement(transaction.advertisement.id, bybitAccountId);
        } catch (error) {
          logger.error('Error deleting advertisement:', error);
        }
      }

      // Start chat automation
      await this.chatService.startAutomation(transaction.id);

      // Start chat polling for this order
      logger.info(`Starting chat polling for order ${order.id}, transaction ${transaction.id}`);
      await this.bybitManager.startChatPolling(transaction.id);
      
      // Start monitoring order status
      this.startOrderMonitoring(order.id, transaction.id, bybitAccountId);

      // Emit event
      this.emit('orderEvent', {
        type: 'ORDER_CREATED',
        orderId: order.id,
        advertisementId,
        data: order
      } as OrderEvent);

    } catch (error) {
      logger.error(`Error processing order ${order.id}:`, error);
    }
  }

  /**
   * Get detailed order information
   */
  private async getOrderDetails(orderId: string, accountId: string): Promise<any> {
    const client = this.bybitManager.getClient(accountId);
    if (!client) {
      return null;
    }

    try {
      const response = await client.request({
        method: 'POST',
        endpoint: '/v5/p2p/order/info',
        data: { orderId }
      });

      return response.result;
    } catch (error) {
      logger.error('Error getting order details:', error);
      return null;
    }
  }

  /**
   * Delete advertisement after order creation
   */
  private async deleteAdvertisement(advertisementId: string, accountId: string): Promise<void> {
    const client = this.bybitManager.getClient(accountId);
    if (!client) {
      logger.error(`No client found for account ${accountId}`);
      return;
    }

    try {
      // Get advertisement details from DB
      const advertisement = await prisma.advertisement.findUnique({
        where: { id: advertisementId }
      });

      if (!advertisement || !advertisement.bybitAdId) {
        logger.error(`Advertisement ${advertisementId} not found or has no bybitAdId`);
        return;
      }

      logger.info(`Deleting advertisement ${advertisementId} (Bybit ID: ${advertisement.bybitAdId})`);

      // Cancel on Bybit using the new method
      await client.cancelAdvertisement(advertisement.bybitAdId);

      // Update status in DB
      await prisma.advertisement.update({
        where: { id: advertisementId },
        data: { 
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Also update the Bybit account's active ads count
      await prisma.bybitAccount.update({
        where: { id: advertisement.bybitAccountId },
        data: {
          activeAdsCount: {
            decrement: 1
          }
        }
      });

      logger.info(`✅ Advertisement ${advertisementId} deleted successfully from Bybit`);
    } catch (error) {
      logger.error(`Error deleting advertisement ${advertisementId}:`, error);
      // Don't throw - we don't want to fail the whole order process
    }
  }

  /**
   * Start monitoring order status changes
   */
  private startOrderMonitoring(orderId: string, transactionId: string, accountId: string): void {
    // Monitor for 30 minutes max
    const maxMonitorTime = 30 * 60 * 1000;
    
    const checkStatus = async () => {
      try {
        const orderDetails = await this.getOrderDetails(orderId, accountId);
        if (!orderDetails) {
          return;
        }

        const oldStatus = await this.getTransactionStatus(transactionId);
        const newStatus = this.mapOrderStatus(orderDetails.status);

        if (oldStatus !== newStatus) {
          logger.info(`Order ${orderId} status changed: ${oldStatus} -> ${newStatus}`);
          
          await this.updateTransactionStatus(transactionId, newStatus);
          
          this.emit('orderEvent', {
            type: 'ORDER_STATUS_CHANGED',
            orderId,
            status: newStatus,
            data: orderDetails
          } as OrderEvent);

          // Stop monitoring if completed or failed
          if (newStatus === 'COMPLETED' || newStatus === 'CANCELLED') {
            this.stopOrderMonitoring(orderId);
          }
        }
      } catch (error) {
        logger.error(`Error monitoring order ${orderId}:`, error);
      }
    };

    // Check every 30 seconds
    const intervalId = setInterval(checkStatus, 30000);
    this.orderMonitors.set(orderId, intervalId);

    // Stop monitoring after max time
    setTimeout(() => {
      this.stopOrderMonitoring(orderId);
    }, maxMonitorTime);
  }

  /**
   * Stop monitoring specific order
   */
  private stopOrderMonitoring(orderId: string): void {
    const intervalId = this.orderMonitors.get(orderId);
    if (intervalId) {
      clearInterval(intervalId);
      this.orderMonitors.delete(orderId);
    }
  }

  /**
   * Map Bybit order status to our status
   */
  private mapOrderStatus(bybitStatus: number): string {
    switch (bybitStatus) {
      case 5: // waiting for chain
        return 'pending';
      case 10: // waiting for buy pay (Платеж в обработке)
        return 'waiting_payment';
      case 20: // waiting for seller release (Платеж получен)
        return 'payment_received';
      case 30: // Appealing
      case 100: // objectioning
      case 110: // Waiting for objection
        return 'failed';
      case 40: // completed
        return 'completed';
      case 50: // cancelled by user
      case 60: // cancelled by system
      case 70: // cancelled by admin
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Get current transaction status
   */
  private async getTransactionStatus(transactionId: string): Promise<string> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { status: true }
    });
    return transaction?.status || 'pending';
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(transactionId: string, status: string): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'payment_received') {
      updateData.paymentSentAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: updateData
    });
  }

  /**
   * Sync chat messages from Bybit to database
   */
  private async syncChatMessages(orderId: string, accountId: string): Promise<void> {
    try {
      const client = this.bybitManager.getClient(accountId);
      if (!client) return;

      // Get transaction
      const transaction = await prisma.transaction.findFirst({
        where: { orderId },
        include: { advertisement: true }
      });

      if (!transaction) return;

      // Get chat messages from Bybit
      const chatResponse = await client.getChatMessages(orderId, 1, 50);
      if (!chatResponse.list || chatResponse.list.length === 0) return;

      // Get order details to know who is who
      const orderDetails = await this.getOrderDetails(orderId, accountId);
      if (!orderDetails) return;

      // Sync messages
      for (const msg of chatResponse.list) {
        if (!msg.message) continue;

        // Check if message already exists
        const existingMsg = await prisma.chatMessage.findFirst({
          where: {
            transactionId: transaction.id,
            messageId: msg.id || msg.msgUuid || `${msg.createDate}_${msg.userId}`
          }
        });

        if (!existingMsg) {
          // Determine sender
          const sender = msg.userId === orderDetails.userId ? 'us' : 'counterparty';
          
          // Save message
          await prisma.chatMessage.create({
            data: {
              transactionId: transaction.id,
              messageId: msg.id || msg.msgUuid || `${msg.createDate}_${msg.userId}`,
              sender: sender,
              content: msg.message,
              messageType: msg.contentType === 'str' ? 'TEXT' : msg.contentType?.toUpperCase() || 'TEXT',
              isProcessed: sender === 'us'
            }
          });

          logger.info(`Synced message: [${sender}] ${msg.message.substring(0, 50)}...`);
          
          // If it's from counterparty, emit event
          if (sender === 'counterparty') {
            this.emit('chatMessage', {
              transactionId,
              message: msg,
              sender
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error syncing chat messages for order ${orderId}:`, error);
    }
  }

  /**
   * Handle chat messages from automation service
   */
  private async handleChatMessage(data: any): Promise<void> {
    const { transactionId, message, sender } = data;
    
    try {
      // Save message to DB
      await prisma.chatMessage.create({
        data: {
          transactionId,
          messageId: message.id || Date.now().toString(),
          sender,
          content: message.content,
          messageType: message.type || 'TEXT',
          isProcessed: true
        }
      });
    } catch (error) {
      logger.error('Error saving chat message:', error);
    }
  }
}

// Export for convenience
export async function startP2POrderProcessor(
  bybitManager: BybitP2PManagerService,
  chatService: ChatAutomationService,
  config?: OrderProcessorConfig
): Promise<P2POrderProcessor> {
  const processor = new P2POrderProcessor(bybitManager, chatService, config);
  await processor.start();
  return processor;
}