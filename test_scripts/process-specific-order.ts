import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function processSpecificOrder() {
  const orderId = process.argv[2];
  
  if (!orderId) {
    console.log("Usage: bun run process-specific-order.ts <orderId>");
    console.log("\nPlease provide the order ID from Bybit");
    return;
  }

  try {
    console.log(`=== Processing Order ${orderId} ===\n`);

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    const accounts = await db.getActiveBybitAccounts();
    
    for (const account of accounts) {
      console.log(`Checking account: ${account.accountId}`);
      
      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;
      
      const httpClient = (client as any).httpClient;

      // Get order details
      console.log("\nGetting order details...");
      try {
        const orderResponse = await httpClient.post("/v5/p2p/order/info", {
          orderId: orderId,
        });
        
        if (orderResponse.ret_code !== 0) {
          console.log(`Error: ${orderResponse.ret_msg}`);
          continue;
        }
        
        const order = orderResponse.result?.result;
        if (!order) {
          console.log("No order found");
          continue;
        }
        
        console.log("\nOrder found!");
        console.log(`- Status: ${order.status} (${getStatusName(order.status)})`);
        console.log(`- Side: ${order.side} (${order.side === 1 ? "SELL" : "BUY"})`);
        console.log(`- Amount: ${order.amount} ${order.currencyId}`);
        console.log(`- Token: ${order.tokenId}`);
        console.log(`- Ad ID: ${order.itemId}`);
        console.log(`- Our user ID: ${order.userId}`);
        console.log(`- Target user: ${order.targetNickName} (${order.targetUserId})`);
        console.log(`- Created: ${new Date(parseInt(order.createDate)).toLocaleString()}`);
        
        // Check if this is an active order
        if (order.status !== 10 && order.status !== 20) {
          console.log("\n⚠️  This order is not active (status must be 10 or 20)");
          continue;
        }
        
        console.log("\n✅ This is an ACTIVE order!");
        
        // Check/create transaction
        let transaction = await db.getTransactionByOrderId(orderId);
        
        if (!transaction) {
          console.log("\nNo transaction found, creating...");
          
          // Find or create advertisement
          let advertisement = await db.prisma.advertisement.findFirst({
            where: {
              bybitAdId: order.itemId,
              bybitAccountId: account.accountId,
            },
          });
          
          if (!advertisement) {
            console.log("Creating advertisement record...");
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
            console.log(`Created advertisement ${advertisement.id}`);
          }
          
          // Create transaction
          transaction = await db.prisma.transaction.create({
            data: {
              advertisementId: advertisement.id,
              orderId: orderId,
              status: order.status === 10 ? "chat_started" : "waiting_payment",
              chatStep: 0,
            },
          });
          
          console.log(`Created transaction ${transaction.id}`);
        } else {
          console.log(`\nFound existing transaction ${transaction.id}`);
        }
        
        // Sync chat messages
        console.log("\nSyncing chat messages...");
        const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
          orderId: orderId,
          size: "50",
        });
        
        if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
          const messages = chatResponse.result.result;
          console.log(`Found ${messages.length} messages`);
          
          // Save messages to DB
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
          
          // Show messages
          console.log("\nChat history:");
          for (const msg of messages.slice(-10)) {
            const sender = msg.userId === order.userId ? "US" : "THEM";
            const time = new Date(parseInt(msg.createDate)).toLocaleTimeString();
            console.log(`[${time}] [${sender}] ${msg.message}`);
          }
        }
        
        // Check if automation needed
        const dbMessages = await db.prisma.chatMessage.findMany({
          where: { transactionId: transaction.id },
        });
        
        const hasOurMessages = dbMessages.some(m => m.sender === "us");
        const hasUnprocessedMessages = dbMessages.some(m => m.sender === "counterparty" && !m.isProcessed);
        
        if (!hasOurMessages && order.status === 10) {
          console.log("\n🤖 No messages from us yet. Starting chat automation...");
          try {
            await chatService.startAutomation(transaction.id);
            console.log("✅ Chat automation started successfully!");
            console.log("The bot will now send the initial greeting message.");
          } catch (error: any) {
            console.error("❌ Error starting automation:", error.message);
          }
        } else if (hasOurMessages) {
          console.log("\n✅ Already have messages from us");
          
          if (hasUnprocessedMessages) {
            console.log("📨 Processing unprocessed messages...");
            await chatService.processUnprocessedMessages();
          }
        }
        
        // Show current status
        console.log("\n=== Current Status ===");
        console.log(`Transaction ID: ${transaction.id}`);
        console.log(`Order ID: ${orderId}`);
        console.log(`Chat Step: ${transaction.chatStep}`);
        console.log(`Status: ${transaction.status}`);
        console.log(`Messages: ${dbMessages.length} (${dbMessages.filter(m => m.sender === "us").length} from us)`);
        
        break; // Found the order, no need to check other accounts
      } catch (error: any) {
        console.error("Error processing order:", error.message);
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.disconnect();
  }
}

function getStatusName(status: number): string {
  const map: Record<number, string> = {
    10: "waiting for buyer to pay",
    20: "waiting for seller to release",
    30: "completed",
    40: "cancelled",
    50: "finished",
  };
  return map[status] || "unknown";
}

processSpecificOrder().catch(console.error);