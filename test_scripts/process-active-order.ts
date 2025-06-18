import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function processActiveOrder(orderId: string) {
  try {
    console.log(`\n=== Processing Active Order ${orderId} ===\n`);

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    // Find the account that has this order
    const accounts = await db.getActiveBybitAccounts();
    
    for (const account of accounts) {
      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;
      
      const httpClient = (client as any).httpClient;

      try {
        // Get order info
        console.log(`Checking account ${account.accountId}...`);
        const orderResponse = await httpClient.post("/v5/p2p/order/info", {
          orderId: orderId,
        });
        
        if (orderResponse.ret_code === 0 && orderResponse.result) {
          const order = orderResponse.result;
          console.log(`\n✅ Order found on account ${account.accountId}!`);
          console.log(`Status: ${order.status} (${getStatusName(order.status)})`);
          console.log(`Amount: ${order.amount} ${order.currencyId}`);
          console.log(`Item ID: ${order.itemId}`);
          
          // Check if transaction exists
          let transaction = await db.getTransactionByOrderId(orderId);
          
          if (!transaction) {
            console.log("\n📝 Creating transaction...");
            
            // Find or create advertisement
            let advertisement = await db.prisma.advertisement.findFirst({
              where: {
                bybitAdId: order.itemId,
                bybitAccountId: account.accountId,
              },
            });
            
            if (!advertisement) {
              console.log("Creating advertisement...");
              advertisement = await db.prisma.advertisement.create({
                data: {
                  bybitAdId: order.itemId,
                  bybitAccountId: account.accountId,
                  side: order.side === 1 ? "SELL" : "BUY",
                  asset: order.tokenId || "USDT",
                  fiatCurrency: order.currencyId || "RUB",
                  price: order.price || "0",
                  quantity: order.quantity || "0",
                  minOrderAmount: order.amount || "0",
                  maxOrderAmount: order.amount || "0",
                  paymentMethod: "Unknown",
                  status: "ONLINE",
                },
              });
            }
            
            // Create transaction
            transaction = await db.prisma.transaction.create({
              data: {
                advertisementId: advertisement.id,
                orderId: orderId,
                status: order.status === 10 ? "chat_started" : 
                       order.status === 20 ? "waiting_payment" : "pending",
                chatStep: 0,
              },
            });
            console.log(`✅ Created transaction ${transaction.id}`);
          } else {
            console.log(`\n✅ Transaction exists: ${transaction.id}`);
          }
          
          // Sync chat messages
          console.log("\n💬 Syncing chat messages...");
          const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
            orderId: orderId,
            size: "50",
          });
          
          if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
            const messages = chatResponse.result.result;
            console.log(`Found ${messages.length} messages`);
            
            // Save all messages
            for (const msg of messages) {
              if (!msg.message) continue;
              
              const sender = msg.userId === order.userId ? "us" : "counterparty";
              
              await db.prisma.chatMessage.upsert({
                where: { messageId: msg.id },
                create: {
                  transactionId: transaction.id,
                  messageId: msg.id,
                  sender: sender,
                  content: msg.message,
                  messageType: msg.contentType === "str" ? "TEXT" : msg.contentType?.toUpperCase() || "TEXT",
                  isProcessed: sender === "us",
                },
                update: {},
              });
            }
            
            // Show recent messages
            console.log("\nRecent messages:");
            const recentMessages = messages.slice(-10);
            for (const msg of recentMessages) {
              const sender = msg.userId === order.userId ? "US" : "THEM";
              const time = new Date(parseInt(msg.timestamp || msg.createTime)).toLocaleTimeString();
              console.log(`[${time}] [${sender}] ${msg.message}`);
            }
            
            // Check if we need to start automation
            const dbMessages = await db.prisma.chatMessage.findMany({
              where: { 
                transactionId: transaction.id,
                sender: "us"
              },
            });
            
            if (dbMessages.length === 0 && order.status === 10) {
              console.log("\n🤖 No messages from us. Starting chat automation...");
              try {
                await chatService.startAutomation(transaction.id);
                console.log("✅ Chat automation started! Initial message sent.");
                
                // Process any unprocessed messages
                await chatService.processUnprocessedMessages();
                console.log("✅ Processed unprocessed messages");
              } catch (error: any) {
                console.error("❌ Error starting automation:", error.message);
              }
            } else if (dbMessages.length > 0) {
              console.log(`\n✅ Found ${dbMessages.length} messages from us`);
              
              // Process unprocessed messages
              const unprocessed = await db.getUnprocessedChatMessages();
              if (unprocessed.length > 0) {
                console.log(`\n📥 Processing ${unprocessed.length} unprocessed messages...`);
                await chatService.processUnprocessedMessages();
                console.log("✅ Processed unprocessed messages");
              }
            }
          }
          
          console.log("\n✅ Order processing complete!");
          return;
        }
      } catch (error: any) {
        if (!error.message?.includes("Order does not exist")) {
          console.error("Error:", error.message);
        }
      }
    }
    
    console.log("\n❌ Order not found on any account");
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
    50: "cancelled",
    60: "completed",
  };
  return map[status] || "unknown";
}

// Get order ID from command line or use the known active order
const orderId = process.argv[2] || "1932450908748996608";
console.log(`Processing order: ${orderId}`);

processActiveOrder(orderId).catch(console.error);