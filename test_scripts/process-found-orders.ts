import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function processFoundOrders() {
  try {
    console.log("=== Processing Found Orders ===\n");

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    const accounts = await db.getActiveBybitAccounts();
    console.log(`Found ${accounts.length} active accounts\n`);

    for (const account of accounts) {
      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;
      
      const httpClient = (client as any).httpClient;

      console.log(`\n📋 Checking account ${account.accountId}...`);

      try {
        // Get orders
        const response = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 20,
        });
        
        if (response.ret_code === 0 && response.result?.items) {
          console.log(`Found ${response.result.items.length} orders!\n`);
          
          for (const order of response.result.items) {
            console.log(`\n🔍 Order ${order.id}`);
            console.log(`   Status: ${order.status} (${getStatusName(order.status)})`);
            console.log(`   Amount: ${order.amount} ${order.currencyId}`);
            console.log(`   Target: ${order.targetNickName}`);
            console.log(`   Created: ${new Date(parseInt(order.createDate)).toLocaleString()}`);
            
            // Process only active orders (status 10 or 20)
            if (order.status === 10 || order.status === 20) {
              console.log(`   ✅ This is an ACTIVE order!`);
              
              // Get full order details to find itemId
              const orderDetails = await httpClient.post("/v5/p2p/order/info", {
                orderId: order.id,
              });
              
              if (orderDetails.ret_code === 0 && orderDetails.result) {
                const fullOrder = orderDetails.result;
                console.log(`   Item ID: ${fullOrder.itemId}`);
                
                // Check if transaction exists
                let transaction = await db.getTransactionByOrderId(order.id);
                
                if (!transaction) {
                  console.log(`   📝 Creating transaction...`);
                  
                  // Find or create advertisement
                  let advertisement = await db.prisma.advertisement.findFirst({
                    where: {
                      bybitAdId: fullOrder.itemId,
                      bybitAccountId: account.accountId,
                    },
                  });
                  
                  if (!advertisement) {
                    console.log(`   Creating advertisement for item ${fullOrder.itemId}...`);
                    advertisement = await db.prisma.advertisement.create({
                      data: {
                        bybitAdId: fullOrder.itemId,
                        bybitAccountId: account.accountId,
                        side: order.side === 1 ? "SELL" : "BUY",
                        asset: order.tokenId || "USDT",
                        fiatCurrency: order.currencyId || "RUB",
                        price: order.price || "79",
                        quantity: order.notifyTokenQuantity || "50",
                        minOrderAmount: order.amount || "4013",
                        maxOrderAmount: order.amount || "4013",
                        paymentMethod: fullOrder.paymentTermList?.[0]?.paymentConfigVo?.paymentName || "Unknown",
                        status: "ONLINE",
                      },
                    });
                  }
                  
                  // Create transaction
                  transaction = await db.prisma.transaction.create({
                    data: {
                      advertisementId: advertisement.id,
                      orderId: order.id,
                      status: order.status === 10 ? "chat_started" : "waiting_payment",
                      chatStep: 0,
                    },
                  });
                  console.log(`   ✅ Created transaction ${transaction.id}`);
                } else {
                  console.log(`   ✅ Transaction exists: ${transaction.id}`);
                }
                
                // Sync chat messages
                console.log(`   💬 Syncing chat messages...`);
                const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
                  orderId: order.id,
                  size: "50",
                });
                
                if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
                  const messages = chatResponse.result.result;
                  console.log(`   Found ${messages.length} messages`);
                  
                  // Save all messages
                  for (const msg of messages) {
                    if (!msg.message) continue;
                    
                    const sender = msg.userId === fullOrder.userId ? "us" : "counterparty";
                    
                    await db.prisma.chatMessage.upsert({
                      where: { messageId: msg.id },
                      create: {
                        transactionId: transaction.id,
                        messageId: msg.id,
                        sender: sender,
                        content: msg.message,
                        messageType: msg.contentType === "str" ? "TEXT" : "TEXT",
                        isProcessed: false,
                      },
                      update: {},
                    });
                  }
                  
                  // Show recent messages
                  if (messages.length > 0) {
                    console.log(`\n   Recent messages:`);
                    for (const msg of messages.slice(-5)) {
                      const sender = msg.userId === fullOrder.userId ? "US" : "THEM";
                      const time = new Date(parseInt(msg.timestamp || msg.createTime || "0")).toLocaleTimeString();
                      console.log(`   [${time}] [${sender}] ${msg.message}`);
                    }
                  }
                }
                
                // Check if we need to start automation
                const ourMessages = await db.prisma.chatMessage.findMany({
                  where: { 
                    transactionId: transaction.id,
                    sender: "us"
                  },
                });
                
                if (ourMessages.length === 0 && order.status === 10) {
                  console.log(`\n   🤖 No messages from us. Starting chat automation...`);
                  try {
                    await chatService.startAutomation(transaction.id);
                    console.log(`   ✅ Chat automation started!`);
                    
                    // Wait a bit for message to be sent
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Process any responses
                    await chatService.processUnprocessedMessages();
                    console.log(`   ✅ Processed unprocessed messages`);
                  } catch (error: any) {
                    console.error(`   ❌ Error starting automation: ${error.message}`);
                  }
                } else if (ourMessages.length > 0) {
                  console.log(`   ✅ Already have ${ourMessages.length} messages from us`);
                  
                  // Still process any unprocessed messages
                  const unprocessed = await db.getUnprocessedChatMessages();
                  if (unprocessed.length > 0) {
                    console.log(`   📥 Processing ${unprocessed.length} unprocessed messages...`);
                    await chatService.processUnprocessedMessages();
                  }
                } else {
                  console.log(`   ℹ️ Order status ${order.status} - no automation needed`);
                }
              }
            } else {
              console.log(`   ⏭️ Skipping - status ${order.status} (${getStatusName(order.status)})`);
            }
          }
        } else {
          console.log("No orders found");
        }
      } catch (error: any) {
        console.error(`Error checking account: ${error.message}`);
      }
    }

    console.log("\n\n✅ Processing complete!");
    
    // Summary
    const transactions = await db.prisma.transaction.findMany({
      where: {
        status: { in: ["chat_started", "waiting_payment"] },
      },
      include: {
        chatMessages: true,
      },
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Active transactions: ${transactions.length}`);
    for (const tx of transactions) {
      console.log(`   - Transaction ${tx.id}: ${tx.status}, ${tx.chatMessages.length} messages`);
    }

  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await db.disconnect();
  }
}

function getStatusName(status: number): string {
  const map: Record<number, string> = {
    5: "waiting for chain",
    10: "waiting for buyer to pay",
    20: "waiting for seller to release",
    30: "appealing",
    40: "cancelled by buyer",
    50: "cancelled by seller",
    60: "completed",
  };
  return map[status] || "unknown";
}

processFoundOrders().catch(console.error);