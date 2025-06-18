/**
 * Instant Order Monitor Service
 * Monitors P2P orders with 1-second polling for instant response
 */

import { db } from "../db";
import { BybitP2PManagerService } from "./bybitP2PManager";
import { ChatAutomationService } from "./chatAutomation";
import { createLogger } from "../logger";

const logger = createLogger('InstantOrderMonitor');

export class InstantOrderMonitorService {
  private bybitManager: BybitP2PManagerService;
  private chatService: ChatAutomationService;
  private _isRunning: boolean = false;
  private knownOrderIds: Set<string> = new Set();
  private lastCheckTime: Map<string, number> = new Map(); // accountId -> timestamp

  get isRunning(): boolean {
    return this._isRunning;
  }

  constructor(
    bybitManager: BybitP2PManagerService,
    chatService: ChatAutomationService,
  ) {
    this.bybitManager = bybitManager;
    this.chatService = chatService;
  }

  /**
   * Start monitoring with instant polling
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      logger.info("Already running");
      return;
    }

    this._isRunning = true;
    logger.info("Starting instant order monitoring...");

    // Initial load of known orders
    await this.loadKnownOrders();

    // Start monitoring loop
    this.monitorLoop();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this._isRunning = false;
    logger.info("Stopped");
  }

  /**
   * Load existing orders from database
   */
  private async loadKnownOrders(): Promise<void> {
    const transactions = await db.prisma.transaction.findMany({
      where: {
        orderId: { not: null },
      },
      select: {
        orderId: true,
      },
    });

    for (const tx of transactions) {
      if (tx.orderId) {
        this.knownOrderIds.add(tx.orderId);
      }
    }

    logger.info("Loaded known orders", { count: this.knownOrderIds.size });
  }

  /**
   * Main monitoring loop - runs every second
   */
  private async monitorLoop(): Promise<void> {
    while (this._isRunning) {
      try {
        await this.checkAllAccounts();
      } catch (error) {
        logger.error("Error in monitor loop", error);
      }

      // Wait 1 second before next check
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Check all accounts for new orders
   */
  private async checkAllAccounts(): Promise<void> {
    const accounts = await db.getActiveBybitAccounts();

    for (const account of accounts) {
      try {
        // Rate limit per account - check each account every 5 seconds
        const lastCheck = this.lastCheckTime.get(account.accountId) || 0;
        const now = Date.now();

        if (now - lastCheck < 5000) {
          continue; // Skip this account for now
        }

        this.lastCheckTime.set(account.accountId, now);

        const client = this.bybitManager.getClient(account.accountId);
        if (!client) continue;

        const httpClient = (client as any).httpClient;

        // Try different endpoints to find orders
        await this.checkPendingOrders(httpClient, account.accountId);
        await this.checkActiveOrders(httpClient, account.accountId);

        // Also check using the direct client methods
        try {
          const pendingOrders = await client.getPendingOrders(1, 50);
          if (pendingOrders.list && pendingOrders.list.length > 0) {
            logger.info("Found orders via getPendingOrders", { count: pendingOrders.list.length });
            await this.processOrders(
              pendingOrders.list.map((o: any) => ({
                ...o,
                bybitAccountId: account.accountId,
              })),
              account.accountId,
            );
          }
        } catch (error) {
          // Silent fail
        }
      } catch (error) {
        // Silent fail for individual accounts
      }
    }
  }

  /**
   * Check pending orders endpoint
   */
  private async checkPendingOrders(
    httpClient: any,
    accountId: string,
  ): Promise<void> {
    try {
      const response = await httpClient.post(
        "/v5/p2p/order/pending/simplifyList",
        {
          page: 1,
          size: 50,
        },
      );

      if (response.result?.items && Array.isArray(response.result.items)) {
        logger.info("Found pending orders", { count: response.result.items.length, accountId });
        await this.processOrders(response.result.items, accountId);
      } else if (response.result?.count > 0) {
        logger.warn("API returned count but empty items", { count: response.result.count, accountId });
      }
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Check active orders endpoint
   */
  private async checkActiveOrders(
    httpClient: any,
    accountId: string,
  ): Promise<void> {
    try {
      const client = this.bybitManager.getClient(accountId);
      if (!client) return;

      // Get all orders without status filter
      const allOrdersResult = await client.getOrdersSimplified({
        page: 1,
        size: 50,
      });

      if (allOrdersResult.items && allOrdersResult.items.length > 0) {
        logger.info("Found orders", { count: allOrdersResult.items.length, accountId });
        await this.processOrders(allOrdersResult.items, accountId);
      }

      // Also specifically check for status 10 (Payment in processing)
      const activeOrdersResult = await client.getOrdersSimplified({
        page: 1,
        size: 50,
        status: 10,
      });

      if (activeOrdersResult.items && activeOrdersResult.items.length > 0) {
        logger.info("Found orders with status 10", { count: activeOrdersResult.items.length, accountId });
        await this.processOrders(activeOrdersResult.items, accountId);
      }

      // Check for status 20 (Waiting for coin transfer)
      const waitingOrdersResult = await client.getOrdersSimplified({
        page: 1,
        size: 50,
        status: 20,
      });

      if (waitingOrdersResult.items && waitingOrdersResult.items.length > 0) {
        logger.info("Found orders with status 20", { count: waitingOrdersResult.items.length, accountId });
        await this.processOrders(waitingOrdersResult.items, accountId);
      }
    } catch (error) {
      // Silent fail but log in debug mode
      if (process.env.DEBUG) {
        logger.error("Error checking active orders", error);
      }
    }
  }

  /**
   * Process found orders
   */
  private async processOrders(orders: any[], accountId: string): Promise<void> {
    // Process all relevant order statuses
    // 10 = Payment in processing (buyer needs to pay)
    // 20 = Waiting for coin transfer (seller needs to release)
    // 30 = Completed
    // 40 = Cancelled
    // 50 = Disputed
    const activeStatuses = [10, 20, 30, 50];

    for (const order of orders) {
      // Skip cancelled orders (status 40)
      if (order.status === 40) continue;

      // Check if this is a new order
      if (!this.knownOrderIds.has(order.id)) {
        logger.info("🆕 New order found", { orderId: order.id, status: order.status });
        this.knownOrderIds.add(order.id);

        try {
          await this.processNewOrder(order, accountId);
        } catch (error) {
          logger.error("Error processing order", error, { orderId: order.id });
        }
      } else {
        // Still check for messages on known orders
        logger.info("Checking messages for known order", { orderId: order.id });
      }

      // Always check for new messages on active orders
      if (order.status === 10 || order.status === 20) {
        await this.checkOrderMessages(order.id, accountId);
      }
    }
  }

  /**
   * Process a newly discovered order
   */
  private async processNewOrder(order: any, accountId: string): Promise<void> {
    const client = this.bybitManager.getClient(accountId);
    if (!client) return;

    const httpClient = (client as any).httpClient;

    // Get full order details
    const detailsResponse = await httpClient.post("/v5/p2p/order/info", {
      orderId: order.id,
    });

    if (!detailsResponse.result?.result) {
      throw new Error("Failed to get order details");
    }

    const orderDetails = detailsResponse.result.result;

    logger.info("Order details received", {
      orderId: order.id,
      itemId: orderDetails.itemId,
      amount: order.amount,
      price: order.price,
    });

    // Find or create advertisement
    let advertisement = await db.prisma.advertisement.findFirst({
      where: {
        bybitAdId: orderDetails.itemId,
        bybitAccountId: accountId,
      },
    });

    if (!advertisement) {
      // Try to find by amount and account - maybe itemId is wrong
      const orderAmount = parseFloat(order.amount || "0");
      
      advertisement = await db.prisma.advertisement.findFirst({
        where: {
          bybitAccountId: accountId,
          quantity: orderAmount.toString(),
          status: "ONLINE",
          createdAt: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // Created in last 10 minutes
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (advertisement) {
        logger.info("Found advertisement by amount match", {
          orderId: order.id,
          advertisementId: advertisement.id,
          bybitAdId: advertisement.bybitAdId,
          amount: orderAmount,
        });
      } else {
        logger.warn("Creating TEMPORARY advertisement for order - this may indicate a problem!", { 
          orderId: order.id,
          itemId: orderDetails.itemId,
        });

        // Create with temp ID to mark it as potentially incorrect
        advertisement = await db.prisma.advertisement.create({
          data: {
            bybitAdId: `temp_${order.id}`, // Use temp_ prefix to identify fake ads
            bybitAccountId: accountId,
            side: order.side === 1 ? "SELL" : "BUY",
            asset: order.tokenId || "USDT",
            fiatCurrency: order.currencyId || "RUB",
            price: order.price || "0",
            quantity: order.amount || "0",
            minOrderAmount: order.amount || "0",
            maxOrderAmount: order.amount || "0",
            paymentMethod: "Bank Transfer", // Changed from "Unknown"
            status: "ONLINE",
          },
        });
      }
    }

    // Check if transaction already exists for this advertisement
    let transaction = await db.prisma.transaction.findFirst({
      where: {
        advertisementId: advertisement.id,
      },
      include: {
        payout: true,
      },
    });

    // Get order amount in RUB
    const orderAmount = parseFloat(order.amount || "0");
    logger.info("Order amount", { orderId: order.id, amount: orderAmount });

    if (transaction) {
      // Verify that payout amount matches order amount
      if (transaction.payout) {
        const payoutData = typeof transaction.payout.amountTrader === "string" 
          ? JSON.parse(transaction.payout.amountTrader) 
          : transaction.payout.amountTrader;
        const payoutAmount = payoutData?.["643"] || 0;
        
        if (Math.abs(payoutAmount - orderAmount) > 1) {
          logger.error("⚠️ AMOUNT MISMATCH DETECTED!", {
            orderId: order.id,
            orderAmount,
            payoutAmount,
            payoutId: transaction.payoutId,
            difference: Math.abs(payoutAmount - orderAmount),
          });
          
          // Try to find correct payout
          const correctPayout = await db.prisma.payout.findFirst({
            where: {
              status: 5,
              transaction: null,
            },
          });
          
          if (correctPayout) {
            const correctPayoutData = typeof correctPayout.amountTrader === "string" 
              ? JSON.parse(correctPayout.amountTrader) 
              : correctPayout.amountTrader;
            const correctAmount = correctPayoutData?.["643"] || 0;
            
            if (Math.abs(correctAmount - orderAmount) < 1) {
              logger.warn("Found correct payout, but cannot auto-fix. Manual intervention needed!", {
                correctPayoutId: correctPayout.gatePayoutId,
                correctAmount,
              });
            }
          }
        } else {
          logger.info("✅ Amount verification passed", {
            orderId: order.id,
            amount: orderAmount,
          });
        }
      }
      
      // Update existing transaction with order ID
      logger.info("Updating existing transaction with order ID", { 
        transactionId: transaction.id, 
        orderId: order.id,
        payoutId: transaction.payoutId 
      });
      
      transaction = await db.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          orderId: order.id,
          status:
            order.status === 10
              ? "chat_started"
              : order.status === 20
                ? "waiting_payment"
                : transaction.status,
          updatedAt: new Date(),
        },
        include: {
          payout: true,
        },
      });
    } else {
      // Create new transaction only if none exists
      logger.warn("Creating transaction without payout - this may cause issues!", { 
        advertisementId: advertisement.id,
        orderId: order.id 
      });
      
      transaction = await db.prisma.transaction.create({
        data: {
          advertisementId: advertisement.id,
          orderId: order.id,
          status:
            order.status === 10
              ? "chat_started"
              : order.status === 20
                ? "waiting_payment"
                : "pending",
          chatStep: 0,
        },
      });
    }

    logger.info("Transaction ready for order", { 
      transactionId: transaction.id, 
      orderId: order.id,
      hasPayoutId: !!transaction.payoutId 
    });

    // Start chat automation immediately for new orders
    if (order.status === 10) {
      logger.info("Starting chat automation for order", { orderId: order.id });
      await this.chatService.startAutomation(transaction.id);
    }

    // Sync existing messages
    await this.syncOrderMessages(
      order.id,
      orderDetails.userId,
      transaction.id,
      httpClient,
    );
  }

  /**
   * Check for new messages in an order
   */
  private async checkOrderMessages(
    orderId: string,
    accountId: string,
  ): Promise<void> {
    const transaction = await db.getTransactionByOrderId(orderId);
    if (!transaction) return;

    const client = this.bybitManager.getClient(accountId);
    if (!client) return;

    const httpClient = (client as any).httpClient;

    try {
      // Get order info to determine our user ID
      const orderResponse = await httpClient.post("/v5/p2p/order/info", {
        orderId: orderId,
      });

      if (!orderResponse.result?.result) return;

      const orderDetails = orderResponse.result.result;
      await this.syncOrderMessages(
        orderId,
        orderDetails.userId,
        transaction.id,
        httpClient,
      );
    } catch (error) {
      // Silent fail for message checking
    }
  }

  /**
   * Sync messages for an order
   */
  private async syncOrderMessages(
    orderId: string,
    ourUserId: string,
    transactionId: string,
    httpClient: any,
  ): Promise<void> {
    const chatResponse = await httpClient.post(
      "/v5/p2p/order/message/listpage",
      {
        orderId: orderId,
        size: "10", // Get recent messages
      },
    );

    if (
      !chatResponse.result?.result ||
      !Array.isArray(chatResponse.result.result)
    ) {
      return;
    }

    let hasNewMessages = false;

    for (const msg of chatResponse.result.result) {
      if (!msg.message) continue;

      // Check if message exists
      const exists = await db.prisma.chatMessage.findFirst({
        where: {
          messageId: msg.id,
        },
      });

      if (!exists) {
        const sender = msg.userId === ourUserId ? "us" : "counterparty";

        await db.prisma.chatMessage.create({
          data: {
            transactionId: transactionId,
            messageId: msg.id,
            sender: sender,
            content: msg.message,
            messageType:
              msg.contentType === "str"
                ? "TEXT"
                : msg.contentType?.toUpperCase() || "TEXT",
            isProcessed: sender === "us",
          },
        });

        if (sender === "counterparty") {
          hasNewMessages = true;
          logger.info("💬 New message from counterparty", {
            orderId,
            preview: msg.message.substring(0, 50) + "..."
          });
        }
      }
    }

    // Process new messages immediately
    if (hasNewMessages) {
      logger.info("Processing messages for order", { orderId, hasNewMessages });
      await this.chatService.processUnprocessedMessages();
    }

    // Check if we need to start automation
    const transaction = await db.getTransactionByOrderId(orderId);
    if (transaction) {
      const messages = await db.prisma.chatMessage.findMany({
        where: {
          transactionId: transaction.id,
          sender: "us",
        },
      });

      if (messages.length === 0) {
        logger.info("No messages from us, starting automation", { orderId });
        await this.chatService.startAutomation(transaction.id);
      }
    }
  }
}
