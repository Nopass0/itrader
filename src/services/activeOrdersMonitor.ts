import { db } from "../db";
import { BybitP2PManagerService } from "./bybitP2PManager";
import { ChatAutomationService } from "./chatAutomation";
import { TimeSync } from "../bybit/utils/timeSync";
import { EventEmitter } from "events";
import { createLogger } from "../logger";

const logger = createLogger('ActiveOrdersMonitor');

export class ActiveOrdersMonitorService extends EventEmitter {
  private bybitManager: BybitP2PManagerService;
  private chatService: ChatAutomationService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  public isMonitoring = false;

  constructor(bybitManager: BybitP2PManagerService) {
    super();
    this.bybitManager = bybitManager;
    this.chatService = new ChatAutomationService(bybitManager);
  }

  async startMonitoring(intervalMs = 30000) {
    if (this.isMonitoring) {
      logger.info("🔄 Already monitoring active orders", {
        interval: intervalMs,
        status: 'running'
      });
      return;
    }

    this.isMonitoring = true;
    logger.info("🚀 Starting active orders monitoring", {
      intervalMs,
      checkEvery: `${intervalMs / 1000} seconds`,
      startTime: new Date().toISOString()
    });

    // Initial check
    await this.checkActiveOrders();

    // Set up interval
    this.monitoringInterval = setInterval(async () => {
      await this.checkActiveOrders();
    }, intervalMs);
  }

  async stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info("Monitoring stopped");
  }

  private async checkActiveOrders() {
    try {
      const checkStartTime = Date.now();
      logger.info("🔍 ========= CHECKING ACTIVE ORDERS =========", {
        timestamp: new Date().toISOString(),
        localTime: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
      });

      // Ensure time sync
      if (!TimeSync.isSynchronized()) {
        await TimeSync.forceSync(false);
      }

      const accounts = await this.bybitManager.getActiveAccounts();
      logger.info("🏦 Active Bybit accounts", { 
        accountCount: accounts.length,
        accountIds: accounts.map(a => a.accountId)
      });

      let totalOrdersFound = 0;
      for (const account of accounts) {
        const ordersFound = await this.checkAccountOrders(account.accountId);
        totalOrdersFound += ordersFound;
      }

      logger.info("📊 Check complete", { 
        totalOrdersFound,
        duration: `${Date.now() - checkStartTime}ms`,
        nextCheckIn: `${this.monitoringInterval ? '30 seconds' : 'N/A'}`
      });

      // Process any unprocessed messages
      logger.info("📨 Processing unprocessed messages...");
      await this.chatService.processUnprocessedMessages();
      
      logger.info("✅ ==========================================");
    } catch (error) {
      logger.error("Error checking orders", error);
      this.emit("error", error);
    }
  }

  private async checkAccountOrders(accountId: string): Promise<number> {
    let ordersFound = 0;
    try {
      const client = this.bybitManager.getClient(accountId);
      const httpClient = (client as any).httpClient;

      logger.info("📋 Checking account orders", { 
        accountId,
        timestamp: new Date().toISOString()
      });

      // Get specific orders from DB
      const activeTransactions = await db.getActiveTransactions();
      logger.info("📜 Active transactions in DB", {
        count: activeTransactions.length,
        withOrderIds: activeTransactions.filter(t => t.orderId).length,
        transactionIds: activeTransactions.map(t => t.id)
      });

      for (const transaction of activeTransactions) {
        if (transaction.orderId) {
          // Check specific order
          await this.processSpecificOrder(
            transaction.orderId,
            accountId,
            httpClient,
          );
        }
      }

      // Also check for new orders
      const newOrdersFound = await this.checkForNewOrders(accountId, httpClient);
      ordersFound += newOrdersFound;
    } catch (error) {
      logger.error("Error checking account", error, { accountId });
    }
    return ordersFound;
  }

  private async processSpecificOrder(
    orderId: string,
    accountId: string,
    httpClient: any,
  ) {
    try {
      logger.info("🔍 Checking specific order", { 
        orderId,
        accountId,
        timestamp: new Date().toISOString()
      });

      // Get order info
      const orderInfo = await httpClient.post("/v5/p2p/order/info", {
        orderId: orderId,
      });

      if (!orderInfo.result) {
        logger.warn("⚠️ Order not found in Bybit", { orderId });
        return;
      }

      const order = orderInfo.result;
      logger.info("📦 Order details", { 
        orderId,
        status: order.status,
        statusText: this.getStatusText(order.status),
        amount: order.amount,
        currency: order.currencyId,
        counterparty: order.targetNickName
      });

      // Only process active orders (status 10 or 20)
      if (order.status === 10 || order.status === 20) {
        await this.processActiveOrder(order, accountId, httpClient);
      }
    } catch (error) {
      logger.error("Error processing order", error, { orderId });
    }
  }

  private async checkForNewOrders(accountId: string, httpClient: any): Promise<number> {
    let ordersFound = 0;
    try {
      const client = this.bybitManager.getClient(accountId);
      if (!client) return 0;

      // First try to get pending orders directly from API
      logger.info("📋 Fetching pending orders from Bybit API...", { accountId });
      
      try {
        // Try pending orders endpoint first
        const pendingResponse = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
          page: 1,
          pageSize: 50
        });
        
        if (pendingResponse.ret_code === 0 && pendingResponse.result?.items && pendingResponse.result.items.length > 0) {
          logger.info("📦 Pending orders found", {
            count: pendingResponse.result.items.length,
            ordersIds: pendingResponse.result.items.map((o: any) => o.id)
          });
          
          for (const order of pendingResponse.result.items) {
            ordersFound++;
            await this.processActiveOrder(order, accountId, httpClient);
          }
          
          return ordersFound;
        }
      } catch (error) {
        logger.warn("⚠️ Pending orders endpoint failed, trying regular endpoint", { error });
      }

      // Get all orders first (without status filter)
      const allOrdersResult = await client.getOrdersSimplified({
        page: 1,
        size: 20,
      });

      logger.info("📦 Total orders from Bybit", { 
        count: allOrdersResult.count,
        itemsReturned: allOrdersResult.items?.length || 0,
        accountId,
        hasMore: allOrdersResult.hasMore
      });

      if (allOrdersResult.items && allOrdersResult.items.length > 0) {
        // Process all orders with relevant statuses
        // Status 10 = Payment in processing
        // Status 20 = Waiting for coin transfer
        // Status 30 = Completed
        // Status 40 = Cancelled
        // Status 50 = Disputed
        const relevantOrders = allOrdersResult.items.filter(
          (order: any) => order.status === 10 || order.status === 20,
        );

        logger.info("🎯 Active orders found", { 
          activeCount: relevantOrders.length,
          totalCount: allOrdersResult.items.length,
          activeOrderIds: relevantOrders.map((o: any) => o.id)
        });
        
        // Display order details
        for (const order of allOrdersResult.items) {
          const statusText = this.getStatusText(order.status);
          logger.info("📦 Order details", {
            orderId: order.id,
            status: order.status,
            statusText,
            amount: `${order.amount} ${order.currencyId}`,
            price: order.price,
            usdt: `${order.notifyTokenQuantity} ${order.notifyTokenId}`,
            counterparty: order.targetNickName,
            created: order.createDate ? new Date(parseInt(order.createDate)).toLocaleString() : 'Unknown'
          });
          
          if (order.status === 10 || order.status === 20) {
            ordersFound++;
            await this.processActiveOrder(order, accountId, httpClient);
          }
        }
      }

      // Check known orders from database
      const knownOrderIds = ["1935291241223102464"]; // Add more known order IDs here
      
      const activeTransactions = await db.getActiveTransactions();
      for (const tx of activeTransactions) {
        if (tx.orderId && !knownOrderIds.includes(tx.orderId)) {
          knownOrderIds.push(tx.orderId);
        }
      }
      
      logger.info("🔍 Checking known orders", { orderIds: knownOrderIds });
      
      for (const orderId of knownOrderIds) {
        try {
          const orderInfo = await httpClient.post("/v5/p2p/order/info", {
            orderId: orderId
          });
          
          if (orderInfo.ret_code === 0 && orderInfo.result) {
            const order = orderInfo.result.result || orderInfo.result;
            if (order.status === 10 || order.status === 20) {
              logger.info("📦 Known order is active", {
                orderId: order.id,
                status: order.status,
                statusText: this.getStatusText(order.status)
              });
              ordersFound++;
              await this.processActiveOrder(order, accountId, httpClient);
            }
          }
        } catch (error) {
          logger.warn("Failed to get order info", { orderId, error });
        }
      }
    } catch (error) {
      logger.error("Error checking new orders", error);
    }
    return ordersFound;
  }

  private async processActiveOrder(
    order: any,
    accountId: string,
    httpClient: any,
  ) {
    logger.info("🔄 Processing active order", { 
      orderId: order.id,
      itemId: order.itemId,
      status: order.status,
      statusText: this.getStatusText(order.status),
      amount: `${order.amount} ${order.currencyId}`,
      counterparty: order.targetNickName
    });

    try {
      // Get order details if itemId is missing
      let itemId = order.itemId;
      if (!itemId) {
        logger.info("📋 Getting order details to find itemId", { orderId: order.id });
        try {
          const orderDetails = await httpClient.post("/v5/p2p/order/info", {
            orderId: order.id
          });
          
          if (orderDetails.ret_code === 0 && orderDetails.result) {
            const detailedOrder = orderDetails.result.result || orderDetails.result;
            itemId = detailedOrder.itemId;
            logger.info("✅ Found itemId from order details", { 
              orderId: order.id, 
              itemId: itemId 
            });
          }
        } catch (error) {
          logger.error("Failed to get order details", error, { orderId: order.id });
        }
      }
      
      if (!itemId) {
        logger.warn("⚠️ Order has no itemId, cannot process", { orderId: order.id });
        return;
      }

      // Find or create transaction
      logger.info("🔍 Looking for transaction in DB", { orderId: order.id });
      let transaction = await db.getTransactionByOrderId(order.id);

      if (!transaction) {
        // Try to find by advertisement ID
        const advertisements = await db.getAdvertisements();
        const advertisement = advertisements.find(ad => ad.bybitAdId === itemId);

        if (advertisement) {
          // Find transaction by advertisement
          const transactions = await db.getActiveTransactions();
          transaction = transactions.find(t => t.advertisementId === advertisement.id && !t.orderId);

          if (transaction) {
            // Update with order ID
            await db.updateTransaction(transaction.id, {
              orderId: order.id,
              status: this.mapOrderStatus(order.status),
            });
            transaction = await db.getTransactionWithDetails(transaction.id);
            logger.info("✅ Linked order to existing transaction", { transactionId: transaction.id, orderId: order.id });
          }
        }
      }

      if (!transaction) {
        logger.warn("⚠️ No transaction found for order, trying to create one", { 
          orderId: order.id,
          itemId: itemId
        });
        
        // Try to find advertisement by itemId
        logger.info("🔍 Searching for advertisement by itemId", { itemId: itemId });
        
        const advertisement = await db.getAdvertisementByBybitId(itemId);
        if (advertisement) {
          logger.info("🔍 Found advertisement for itemId", { 
            itemId: itemId,
            advertisementId: advertisement.id,
            payoutId: advertisement.payoutId
          });
          
          // Check if payout exists
          if (!advertisement.payoutId) {
            logger.error("❌ Advertisement has no payoutId!", { 
              advertisementId: advertisement.id,
              bybitAdId: advertisement.bybitAdId
            });
            return;
          }
          
          // Create new transaction for this order
          transaction = await db.createTransaction({
            payoutId: advertisement.payoutId,
            advertisementId: advertisement.id,
            orderId: order.id,
            amount: parseFloat(order.amount || "0"),
            counterpartyName: order.targetNickName || "Unknown",
            status: this.mapOrderStatus(order.status),
          });
          
          logger.info("✅ Created new transaction for order", { 
            transactionId: transaction.id, 
            orderId: order.id,
            payoutId: advertisement.payoutId
          });
        } else {
          logger.warn("❌ No advertisement found for itemId", { 
            itemId: itemId,
            orderId: order.id
          });
          
          // Let's check all advertisements in DB
          const allAds = await db.getAdvertisements();
          logger.info("📋 All advertisements in DB", {
            count: allAds.length,
            bybitAdIds: allAds.map(ad => ad.bybitAdId)
          });
          
          return;
        }
      }

      // Sync chat messages
      await this.syncChatMessages(
        order.id,
        transaction.id,
        order.userId,
        httpClient,
      );

      // Get updated transaction with messages
      transaction = await db.getTransactionWithDetails(transaction.id);

      // Check if automation needed
      const hasOurMessages = transaction.chatMessages?.some(
        (msg) => msg.sender === "us" || msg.sender === "seller",
      ) || false;
      const hasUnprocessedMessages = transaction.chatMessages?.some(
        (msg) => msg.sender === "counterparty" && !msg.isProcessed,
      ) || false;

      logger.info("📊 Chat stats", {
        totalMessages: transaction.chatMessages?.length || 0,
        hasOurMessages,
        hasUnprocessedMessages
      });
      
      if (transaction.chatMessages && transaction.chatMessages.length > 0) {
        transaction.chatMessages.forEach(msg => {
          logger.info("💬 Message", {
            sender: msg.sender,
            preview: (msg.content || msg.message || '').substring(0, 50) + '...'
          });
        });
      }

      if (!hasOurMessages) {
        logger.info("🤖 No messages from us yet, starting automation...");
        try {
          await this.chatService.startAutomation(transaction.id);
          logger.info("✅ Initial message sent!");
        } catch (error) {
          logger.error("❌ Failed to send initial message", { error });
          // Retry on next iteration
        }
      } else if (hasUnprocessedMessages) {
        logger.info("📨 Has unprocessed messages, processing...");
        await this.chatService.processUnprocessedMessages();
      } else {
        logger.info("✅ Chat is up to date");
      }

      // Start chat polling if not already active
      await this.bybitManager.startChatPolling(transaction.id);

      this.emit("orderProcessed", {
        orderId: order.id,
        transactionId: transaction.id,
        status: order.status,
      });
    } catch (error) {
      logger.error("Error processing order", error);
      this.emit("error", error);
    }
  }

  private async syncChatMessages(
    orderId: string,
    transactionId: string,
    ourUserId: string,
    httpClient: any,
  ) {
    try {
      logger.info("📨 Syncing chat messages from Bybit", { 
        orderId,
        transactionId,
        timestamp: new Date().toISOString()
      });

      const chatResponse = await httpClient.post(
        "/v5/p2p/order/message/listpage",
        {
          orderId: orderId,
          size: "50",
        },
      );

      // Handle both response structures
      let messages = [];
      if (chatResponse.result && Array.isArray(chatResponse.result)) {
        messages = chatResponse.result;
      } else if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
        messages = chatResponse.result.result;
      }

      if (messages.length > 0) {
        logger.info("💬 Chat messages found", { 
          totalMessages: messages.length,
          orderId,
          firstMessageTime: messages[0].createDate ? new Date(parseInt(messages[0].createDate)).toISOString() : 'Unknown'
        });
        
        let newMessagesCount = 0;
        let ourMessagesCount = 0;
        let theirMessagesCount = 0;

        for (const msg of messages) {
          if (!msg.message) continue;

          // Determine sender
          const sender = msg.userId === ourUserId ? "us" : "counterparty";
          
          if (sender === "us") {
            ourMessagesCount++;
          } else {
            theirMessagesCount++;
          }

          // Check if message exists
          const existingMessages = await db.getChatMessages(transactionId);
          const exists = existingMessages.find(m => m.messageId === msg.id);

          if (!exists) {
            newMessagesCount++;
            
            await db.saveChatMessage({
              transactionId: transactionId,
              messageId: msg.id,
              sender: sender,
              content: msg.message,
              messageType:
                msg.contentType === "str"
                  ? "TEXT"
                  : msg.contentType?.toUpperCase() || "TEXT",
              isProcessed: sender === "us",
            });

            logger.info("💬 New message", {
              sender,
              messageId: msg.id,
              preview: msg.message.substring(0, 80) + (msg.message.length > 80 ? '...' : '')
            });
          }
        }
        
        logger.info("📊 Chat sync complete", {
          orderId,
          ourMessages: ourMessagesCount,
          theirMessages: theirMessagesCount,
          newMessages: newMessagesCount,
          totalInDb: (await db.getChatMessages(transactionId)).length
        });
        
        // Show latest message
        if (messages.length > 0) {
          const latestMsg = messages[0]; // Usually the latest message is first
          const sender = latestMsg.userId === ourUserId ? "us" : "counterparty";
          logger.info("📝 Latest message", {
            sender,
            preview: latestMsg.message.substring(0, 80) + (latestMsg.message.length > 80 ? '...' : '')
          });
        }
      } else {
        logger.info("💭 No messages found in chat", { orderId });
      }
    } catch (error) {
      logger.error("Error syncing chat messages", error);
    }
  }

  private mapOrderStatus(bybitStatus: number): string {
    switch (bybitStatus) {
      case 10:
        return "waiting_payment";
      case 20:
        return "payment_received";
      case 30:
        return "completed";
      case 40:
        return "cancelled";
      default:
        return "unknown";
    }
  }

  private getStatusText(status: number): string {
    switch (status) {
      case 10:
        return "Payment in processing";
      case 20:
        return "Waiting for coin transfer";
      case 30:
        return "Completed";
      case 40:
        return "Cancelled";
      case 50:
        return "Disputed";
      default:
        return "Unknown";
    }
  }

  async cleanup() {
    await this.stopMonitoring();
  }
}
