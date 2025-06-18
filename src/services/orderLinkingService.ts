import { db } from "../db";
import { BybitP2PManagerService } from "./bybitP2PManager";
import { createLogger } from "../logger";
import { ChatAutomationService } from "./chatAutomation";

const logger = createLogger("OrderLinkingService");

/**
 * Service to ensure orders are properly linked to transactions
 * This handles cases where ORDER_CREATED events might be missed
 */
export class OrderLinkingService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private bybitManager: BybitP2PManagerService) {}

  /**
   * Start periodic checking for unlinked orders
   */
  start(intervalMs: number = 30000): void {
    if (this.isRunning) {
      logger.warn("⚠️ [OrderLinking] Service is already running");
      console.log("[OrderLinking] Service is already running");
      return;
    }

    this.isRunning = true;
    logger.info("🚀 [OrderLinking] Starting OrderLinkingService", { 
      intervalMs,
      checkEvery: `${intervalMs / 1000} seconds`
    });
    console.log(`\n[OrderLinking] === SERVICE STARTED ===`);
    console.log(`[OrderLinking] Will check for unlinked orders every ${intervalMs / 1000} seconds`);
    console.log(`[OrderLinking] Running first check immediately...\n`);

    // Run immediately
    this.checkAndLinkOrders();

    // Then run periodically
    this.checkInterval = setInterval(() => {
      this.checkAndLinkOrders();
    }, intervalMs);
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
    logger.info("Stopped OrderLinkingService");
  }

  /**
   * Check for active orders and link them to transactions
   */
  private async checkAndLinkOrders(): Promise<void> {
    try {
      logger.info("🔍 [OrderLinking] Checking for unlinked orders...");
      console.log("\n[OrderLinking] === CHECKING FOR UNLINKED ORDERS ===");
      console.log(`[OrderLinking] Time: ${new Date().toISOString()}`);

      // First check known active orders
      const knownActiveOrderIds = [
        "1935291241223102464", // Current active order
        // Add more order IDs here as needed
      ];
      
      for (const orderId of knownActiveOrderIds) {
        await this.checkSpecificOrder(orderId);
      }
      
      // Then check transactions without orders
      await this.checkSpecificOrders();
      
      // Also check for transactions without orders (cleanup)
      await this.checkTransactionsWithoutOrders();
      
      console.log("[OrderLinking] === CHECK COMPLETE ===");
      console.log("");
      return;

      logger.info(`📦 [OrderLinking] Found ${activeOrders.length} orders to check (including completed)`);
      console.log(`[OrderLinking] Found ${activeOrders.length} active orders to check`);

      for (const order of activeOrders) {
        try {
          // Get order details to find itemId
          console.log(`[OrderLinking] Getting details for order ${order.id}...`);
          const orderDetails = await this.bybitManager.getOrderDetails(
            order.id,
            order.bybitAccountId
          );

          if (!orderDetails.itemId) {
            logger.warn("Order has no itemId", { orderId: order.id });
            console.log(`[OrderLinking] ⚠️ Order ${order.id} has no itemId, skipping`);
            continue;
          }

          console.log(`[OrderLinking] Order ${order.id} has itemId: ${orderDetails.itemId}`);

          // Check if we have an advertisement for this itemId
          console.log(`[OrderLinking] Searching for advertisement with bybitAdId: ${orderDetails.itemId}`);
          const advertisement = await db.prisma.advertisement.findUnique({
            where: { bybitAdId: orderDetails.itemId },
            include: { transaction: true },
          });

          if (!advertisement) {
            logger.info("❌ [OrderLinking] No advertisement found for order", {
              orderId: order.id,
              itemId: orderDetails.itemId,
            });
            console.log(`[OrderLinking] ❌ No advertisement found for itemId ${orderDetails.itemId}`);
            continue;
          }

          console.log(`[OrderLinking] ✅ Found advertisement ${advertisement.id} for itemId ${orderDetails.itemId}`);

          // Check if transaction exists and has orderId
          if (!advertisement.transaction) {
            console.log(`[OrderLinking] ⚠️ Advertisement ${advertisement.id} has no transaction`);
            continue;
          }

          if (advertisement.transaction.orderId === order.id) {
            logger.info("✅ [OrderLinking] Order already linked", {
              orderId: order.id,
              transactionId: advertisement.transaction.id,
            });
            console.log(`[OrderLinking] ✅ Order ${order.id} already linked to transaction ${advertisement.transaction.id}`);
            continue;
          }

          console.log(`[OrderLinking] 🔗 Need to link order ${order.id} to transaction ${advertisement.transaction.id}`);

          // Link the order
          logger.info("Linking order to transaction", {
            orderId: order.id,
            itemId: orderDetails.itemId,
            advertisementId: advertisement.id,
          });

          const payoutService = this.bybitManager.getPayoutAdvertisingService();
          
          try {
            const linkedTransaction = await payoutService.linkOrderToTransaction(
              orderDetails.itemId,
              order.id,
              parseFloat(orderDetails.price || "0")
            );

            logger.info("Successfully linked order to transaction", {
              orderId: order.id,
              transactionId: linkedTransaction.id,
              payoutId: linkedTransaction.payoutId,
            });

            // Start chat polling only for active orders (not completed or cancelled)
            if (order.status !== 40 && order.status !== 50) {
              try {
                await this.bybitManager.startChatPolling(linkedTransaction.id);
                logger.info("Started chat polling for order", { orderId: order.id });
              } catch (error) {
                logger.error("Failed to start chat polling", error as Error, {
                  orderId: order.id,
                  transactionId: linkedTransaction.id,
                });
              }
            } else {
              logger.info("Skipping chat polling for completed/cancelled order", {
                orderId: order.id,
                status: order.status
              });
            }

          } catch (error) {
            logger.error("Failed to link order", error as Error, {
              orderId: order.id,
              itemId: orderDetails.itemId,
            });
          }

        } catch (error) {
          logger.error("❌ [OrderLinking] Error processing order", error as Error, {
            orderId: order.id,
          });
          console.log(`[OrderLinking] ❌ Error processing order ${order.id}:`, error);
        }
      }

      // Also check for transactions without orders (cleanup)
      await this.checkTransactionsWithoutOrders();

      console.log("[OrderLinking] === CHECK COMPLETE ===");
      console.log("");
    } catch (error) {
      logger.error("❌ [OrderLinking] Error in checkAndLinkOrders", error as Error);
      console.log("[OrderLinking] ❌ Error in checkAndLinkOrders:", error);
    }
  }

  /**
   * Check for transactions that should have orders but don't
   */
  private async checkTransactionsWithoutOrders(): Promise<void> {
    try {
      // Find transactions in chat_started or waiting_payment status without orderId
      const transactionsWithoutOrders = await db.prisma.transaction.findMany({
        where: {
          orderId: null,
          status: {
            in: ["chat_started", "waiting_payment", "pending"],
          },
        },
        include: {
          advertisement: true,
        },
        take: 10, // Limit to prevent overwhelming the system
      });

      if (transactionsWithoutOrders.length === 0) {
        return;
      }

      logger.info(`🔍 [OrderLinking] Found ${transactionsWithoutOrders.length} transactions without orders`);
      console.log(`[OrderLinking] 🔍 Checking ${transactionsWithoutOrders.length} transactions without orders`);

      for (const transaction of transactionsWithoutOrders) {
        if (!transaction.advertisement) {
          logger.warn("Transaction has no advertisement", {
            transactionId: transaction.id,
          });
          continue;
        }

        // Check if this advertisement has any active orders
        const activeOrders = await this.bybitManager.getAllActiveOrders();
        
        const matchingOrder = activeOrders.find(order => {
          // We'll need to get order details to match by itemId
          return false; // This would need async operation
        });

        // For now, just log the orphaned transaction
        logger.warn("Transaction without order", {
          transactionId: transaction.id,
          advertisementId: transaction.advertisementId,
          bybitAdId: transaction.advertisement.bybitAdId,
          status: transaction.status,
          createdAt: transaction.createdAt,
        });

        // If transaction is old (> 1 hour) and still has no order, it might be stale
        const ageInMs = Date.now() - transaction.createdAt.getTime();
        if (ageInMs > 60 * 60 * 1000) {
          logger.warn("Transaction is stale (> 1 hour old)", {
            transactionId: transaction.id,
            ageInMinutes: Math.floor(ageInMs / 1000 / 60),
          });
          
          // Could update status to 'failed' or 'cancelled' here if needed
        }
      }
    } catch (error) {
      logger.error("Error checking transactions without orders", error as Error);
    }
  }

  /**
   * Check a specific order by ID
   */
  private async checkSpecificOrder(orderId: string): Promise<void> {
    try {
      const accounts = await this.bybitManager.getActiveAccounts();
      
      for (const account of accounts) {
        try {
          console.log(`[OrderLinking] Checking order ${orderId} on account ${account.accountId}...`);
          
          const orderDetails = await this.bybitManager.getOrderDetails(orderId, account.accountId);
          
          if (orderDetails && orderDetails.itemId) {
            console.log(`[OrderLinking] Order ${orderId} found with itemId: ${orderDetails.itemId}`);
            
            // Check if we have an advertisement for this itemId
            const advertisement = await db.prisma.advertisement.findUnique({
              where: { bybitAdId: orderDetails.itemId },
              include: { transaction: true },
            });

            if (advertisement && advertisement.transaction && !advertisement.transaction.orderId) {
              console.log(`[OrderLinking] Linking order ${orderId} to transaction ${advertisement.transaction.id}`);
              
              await db.prisma.transaction.update({
                where: { id: advertisement.transaction.id },
                data: {
                  orderId: orderId,
                  status: orderDetails.status === 10 ? "chat_started" : orderDetails.status === 20 ? "waiting_payment" : "processing"
                }
              });

              logger.info("✅ [OrderLinking] Successfully linked specific order", {
                orderId: orderId,
                transactionId: advertisement.transaction.id,
                itemId: orderDetails.itemId
              });

              // Start chat automation for status 10
              if (orderDetails.status === 10) {
                try {
                  const chatService = new ChatAutomationService(this.bybitManager);
                  await chatService.startAutomation(advertisement.transaction.id);
                  logger.info("💬 [OrderLinking] Started chat automation for specific order");
                } catch (error) {
                  logger.error("Failed to start chat automation", error as Error);
                }
              }
              
              return; // Order found and linked, no need to check other accounts
            }
          }
        } catch (error) {
          // Continue to next account
        }
      }
    } catch (error) {
      logger.error("Error checking specific order", error as Error, { orderId });
    }
  }

  /**
   * Check all orders from Bybit API and link them to transactions
   */
  private async checkSpecificOrders(): Promise<void> {
    try {
      logger.info("🔍 [OrderLinking] Getting active orders from Bybit API...");
      console.log("[OrderLinking] Fetching active orders from Bybit...");

      // Get accounts
      const accounts = await this.bybitManager.getActiveAccounts();
      
      for (const account of accounts) {
        try {
          const client = this.bybitManager.getClient(account.accountId);
          if (!client) continue;

          console.log(`[OrderLinking] Getting orders for account ${account.accountId}...`);

          // Try to get orders from Bybit API
          // Since getOrdersSimplified returns empty items, let's use the pending orders endpoint
          const httpClient = (client as any).httpClient;
          
          console.log(`[OrderLinking] Trying to get orders from different endpoints...`);
          
          let allOrders = [];
          
          // Try 1: Get pending orders
          try {
            console.log(`[OrderLinking] Trying pending orders endpoint...`);
            const pendingResponse = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
              page: 1,
              pageSize: 50
            });
            
            if (pendingResponse.ret_code === 0 && pendingResponse.result?.items) {
              console.log(`[OrderLinking] Pending orders found: ${pendingResponse.result.items.length}`);
              allOrders = allOrders.concat(pendingResponse.result.items);
            }
          } catch (error) {
            console.log(`[OrderLinking] Pending orders endpoint failed`);
          }
          
          // Try 2: Get orders with specific statuses
          const statusesToCheck = [10, 20]; // Active statuses
          for (const status of statusesToCheck) {
            try {
              console.log(`[OrderLinking] Trying to get orders with status ${status}...`);
              const statusResponse = await httpClient.post("/v5/p2p/order/simplifyList", {
                page: 1,
                size: 50,
                status: status
              });
              
              if (statusResponse.ret_code === 0 && statusResponse.result?.items) {
                console.log(`[OrderLinking] Orders with status ${status}: ${statusResponse.result.items.length}`);
                allOrders = allOrders.concat(statusResponse.result.items);
              }
            } catch (error) {
              console.log(`[OrderLinking] Failed to get orders with status ${status}`);
            }
          }
          
          // Try 3: Check known orders from DB
          console.log(`[OrderLinking] Checking known orders from database...`);
          const knownOrderIds = new Set<string>();
          
          // Add known active order
          knownOrderIds.add("1935291241223102464");
          
          // Add orders from active transactions
          const activeTransactions = await db.prisma.transaction.findMany({
            where: {
              orderId: { not: null },
              status: { in: ["chat_started", "waiting_payment", "payment_received", "processing"] }
            }
          });
          
          for (const tx of activeTransactions) {
            if (tx.orderId) {
              knownOrderIds.add(tx.orderId);
            }
          }
          
          console.log(`[OrderLinking] Known order IDs to check: ${Array.from(knownOrderIds).join(", ")}`);
          
          // Check each known order
          for (const orderId of knownOrderIds) {
            try {
              const orderInfo = await httpClient.post("/v5/p2p/order/info", {
                orderId: orderId
              });
              
              if (orderInfo.ret_code === 0 && orderInfo.result) {
                const order = orderInfo.result.result || orderInfo.result;
                console.log(`[OrderLinking] Order ${orderId} details - status: ${order.status}, itemId: ${order.itemId}`);
                
                // Only add active orders
                if (order.status === 10 || order.status === 20 || order.status === 30) {
                  allOrders.push(order);
                }
              }
            } catch (error) {
              console.log(`[OrderLinking] Failed to get details for order ${orderId}`);
            }
          }
          
          // Remove duplicates
          const uniqueOrders = Array.from(new Map(allOrders.map(order => [order.id, order])).values());
          
          console.log(`[OrderLinking] Total unique orders found: ${uniqueOrders.length}`);
          
          if (uniqueOrders.length === 0) {
            console.log("[OrderLinking] No active orders found");
            continue;
          }

          // Process each order
          let processedCount = 0;
          for (const order of uniqueOrders) {
            console.log(`[OrderLinking] Processing order ${order.id} (status: ${order.status})`);
            
            try {
              // Get full order details if we don't have itemId
              let itemId = order.itemId;
              
              if (!itemId) {
                console.log(`[OrderLinking] Getting full details for order ${order.id}...`);
                const orderDetails = await this.bybitManager.getOrderDetails(order.id, account.accountId);
                
                if (!orderDetails || !orderDetails.itemId) {
                  console.log(`[OrderLinking] Order ${order.id} has no itemId`);
                  continue;
                }
                
                itemId = orderDetails.itemId;
              }

              console.log(`[OrderLinking] Order ${order.id} has itemId: ${itemId}`);

              // Find advertisement by itemId
              const advertisement = await db.prisma.advertisement.findUnique({
                where: { bybitAdId: itemId },
                include: { transaction: true },
              });

              if (!advertisement) {
                console.log(`[OrderLinking] No advertisement found for itemId ${itemId}`);
                continue;
              }

              console.log(`[OrderLinking] Found advertisement ${advertisement.id} for itemId ${itemId}`);

              if (!advertisement.transaction) {
                console.log(`[OrderLinking] Advertisement has no transaction`);
                continue;
              }

              if (!advertisement.transaction.orderId) {
                // Link the order to transaction
                console.log(`[OrderLinking] Linking order ${order.id} to transaction ${advertisement.transaction.id}`);
                
                await db.prisma.transaction.update({
                  where: { id: advertisement.transaction.id },
                  data: {
                    orderId: order.id,
                    status: order.status === 10 ? "chat_started" : order.status === 20 ? "waiting_payment" : "processing"
                  }
                });

                logger.info("✅ [OrderLinking] Successfully linked order", {
                  orderId: order.id,
                  transactionId: advertisement.transaction.id,
                  itemId: itemId
                });

                processedCount++;

                // Start chat automation for status 10 (waiting for payment)
                if (order.status === 10) {
                  try {
                    const chatService = new ChatAutomationService(this.bybitManager);
                    await chatService.startAutomation(advertisement.transaction.id);
                    logger.info("💬 [OrderLinking] Started chat automation");
                  } catch (error) {
                    logger.error("Failed to start chat automation", error as Error);
                  }
                }
              } else {
                console.log(`[OrderLinking] Order ${order.id} already linked to transaction ${advertisement.transaction.id}`);
              }
            } catch (error) {
              console.error(`[OrderLinking] Error processing order ${order.id}:`, error);
              logger.error("Error processing order", error as Error, {
                orderId: order.id,
                accountId: account.accountId
              });
            }
          }
          
          if (processedCount > 0) {
            console.log(`[OrderLinking] Successfully linked ${processedCount} orders`);
          }
        } catch (error) {
          console.error(`[OrderLinking] Error checking account ${account.accountId}:`, error);
        }
      }
    } catch (error) {
      logger.error("Error in checkSpecificOrders", error as Error);
    }
  }
}