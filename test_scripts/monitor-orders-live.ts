import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function monitorOrdersLive() {
  try {
    console.log("=== Starting Live Order Monitor ===\n");

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    console.log("Monitor is running. Checking every 5 seconds...");
    console.log("Press Ctrl+C to stop\n");

    // Track processed orders
    const processedOrders = new Set<string>();

    while (true) {
      try {
        const accounts = await db.getActiveBybitAccounts();
        
        for (const account of accounts) {
          const client = bybitManager.getClient(account.accountId);
          if (!client) continue;
          
          const httpClient = (client as any).httpClient;

          // Try different endpoints
          try {
            // 1. Check pending orders
            const pendingResponse = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
              page: 1,
              pageSize: 20,
            });
            
            if (pendingResponse.ret_code === 0 && pendingResponse.result?.items?.length > 0) {
              console.log(`\n[${new Date().toLocaleTimeString()}] Found ${pendingResponse.result.items.length} pending orders`);
              
              for (const order of pendingResponse.result.items) {
                if (!processedOrders.has(order.id)) {
                  await processNewOrder(order, account.accountId);
                  processedOrders.add(order.id);
                }
              }
            }
          } catch (error) {
            // Silent fail
          }

          // 2. Check regular orders
          try {
            const response = await httpClient.post("/v5/p2p/order/simplifyList", {
              page: 1,
              size: 20,
            });
            
            if (response.ret_code === 0 && response.result?.items?.length > 0) {
              console.log(`\n[${new Date().toLocaleTimeString()}] Found ${response.result.items.length} orders`);
              
              for (const order of response.result.items) {
                if ([10, 20].includes(order.status) && !processedOrders.has(order.id)) {
                  await processNewOrder(order, account.accountId);
                  processedOrders.add(order.id);
                }
              }
            }
          } catch (error) {
            // Silent fail
          }

          // 3. Check known order directly
          const knownOrderId = "1932450908748996608";
          if (!processedOrders.has(knownOrderId)) {
            try {
              const orderResponse = await httpClient.post("/v5/p2p/order/info", {
                orderId: knownOrderId,
              });
              
              if (orderResponse.ret_code === 0 && orderResponse.result) {
                const order = orderResponse.result;
                console.log(`\n[${new Date().toLocaleTimeString()}] Found known order! Status: ${order.status}`);
                
                await processNewOrder({
                  id: order.id,
                  status: order.status,
                  amount: order.amount,
                  currencyId: order.currencyId,
                  itemId: order.itemId,
                  userId: order.userId,
                  targetNickName: order.targetNickName,
                }, account.accountId);
                
                processedOrders.add(knownOrderId);
              }
            } catch (error) {
              // Silent fail
            }
          }
        }

        // Check for new messages on existing transactions
        const activeTransactions = await db.prisma.transaction.findMany({
          where: {
            status: { in: ["chat_started", "waiting_payment"] },
            orderId: { not: null },
          },
          include: {
            chatMessages: true,
            advertisement: true,
          },
        });

        for (const transaction of activeTransactions) {
          if (!transaction.orderId) continue;
          
          const account = await db.prisma.bybitAccount.findFirst({
            where: { accountId: transaction.advertisement.bybitAccountId },
          });
          
          if (!account) continue;
          
          const client = bybitManager.getClient(account.accountId);
          if (!client) continue;
          
          const httpClient = (client as any).httpClient;
          
          try {
            const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
              orderId: transaction.orderId,
              size: "10",
            });
            
            if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
              for (const msg of chatResponse.result.result) {
                if (!msg.message) continue;
                
                const exists = await db.prisma.chatMessage.findFirst({
                  where: { messageId: msg.id },
                });
                
                if (!exists) {
                  // Get order info to determine sender
                  const orderInfo = await httpClient.post("/v5/p2p/order/info", {
                    orderId: transaction.orderId,
                  });
                  
                  const sender = msg.userId === orderInfo.result.userId ? "us" : "counterparty";
                  
                  await db.prisma.chatMessage.create({
                    data: {
                      transactionId: transaction.id,
                      messageId: msg.id,
                      sender: sender,
                      content: msg.message,
                      messageType: "TEXT",
                      isProcessed: false,
                    },
                  });
                  
                  console.log(`\n[${new Date().toLocaleTimeString()}] New message from ${sender}: ${msg.message.substring(0, 50)}...`);
                }
              }
            }
          } catch (error) {
            // Silent fail
          }
        }

        // Process unprocessed messages
        await chatService.processUnprocessedMessages();

      } catch (error) {
        console.error("Monitor error:", error);
      }

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    async function processNewOrder(order: any, accountId: string) {
      console.log(`\n🆕 New order found: ${order.id} (Status: ${order.status})`);
      
      let transaction = await db.getTransactionByOrderId(order.id);
      
      if (!transaction) {
        // Create transaction
        let advertisement = await db.prisma.advertisement.findFirst({
          where: {
            bybitAdId: order.itemId || order.id,
            bybitAccountId: accountId,
          },
        });
        
        if (!advertisement) {
          advertisement = await db.prisma.advertisement.create({
            data: {
              bybitAdId: order.itemId || order.id,
              bybitAccountId: accountId,
              side: "SELL",
              asset: "USDT",
              fiatCurrency: order.currencyId || "RUB",
              price: order.price || "79",
              quantity: "50",
              minOrderAmount: order.amount || "4013",
              maxOrderAmount: order.amount || "4013",
              paymentMethod: "Unknown",
              status: "ONLINE",
            },
          });
        }
        
        transaction = await db.prisma.transaction.create({
          data: {
            advertisementId: advertisement.id,
            orderId: order.id,
            status: order.status === 10 ? "chat_started" : "waiting_payment",
            chatStep: 0,
          },
        });
        
        console.log(`✅ Created transaction ${transaction.id}`);
        
        // Start automation for new orders
        if (order.status === 10) {
          await chatService.startAutomation(transaction.id);
          console.log(`✅ Chat automation started`);
        }
      }
    }

  } catch (error) {
    console.error("Failed:", error);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n\nShutting down...");
  await db.disconnect();
  process.exit(0);
});

monitorOrdersLive().catch(console.error);