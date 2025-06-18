import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function processOrder(orderId: string) {
  try {
    console.log(`\n=== Processing Order ${orderId} ===\n`);

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
      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;
      
      const httpClient = (client as any).httpClient;

      try {
        console.log(`Checking account ${account.accountId}...`);
        
        // Get order info
        const orderResponse = await httpClient.post("/v5/p2p/order/info", {
          orderId: orderId,
        });
        
        console.log("Order response code:", orderResponse.ret_code);
        
        if (orderResponse.ret_code === 0 && orderResponse.result) {
          const order = orderResponse.result;
          console.log(`\n✅ Order found!`);
          console.log(`Status: ${order.status}`);
          console.log(`Amount: ${order.amount} ${order.currencyId}`);
          console.log(`Item ID: ${order.itemId}`);
          console.log(`User ID: ${order.userId}`);
          console.log(`Target: ${order.targetNickName}`);
          
          // Check/create transaction
          let transaction = await db.getTransactionByOrderId(orderId);
          
          if (!transaction) {
            console.log("\n📝 Creating transaction...");
            
            // Create minimal advertisement
            const advertisement = await db.prisma.advertisement.create({
              data: {
                bybitAdId: order.itemId,
                bybitAccountId: account.accountId,
                side: order.side === 1 ? "SELL" : "BUY",
                asset: order.tokenId || "USDT",
                fiatCurrency: order.currencyId || "RUB",
                price: order.price || "79",
                quantity: order.quantity || "50",
                minOrderAmount: order.amount || "4013",
                maxOrderAmount: order.amount || "4013",
                paymentMethod: "Unknown",
                status: "ONLINE",
              },
            });
            
            transaction = await db.prisma.transaction.create({
              data: {
                advertisementId: advertisement.id,
                orderId: orderId,
                status: "chat_started",
                chatStep: 0,
              },
            });
            
            console.log(`✅ Created transaction ${transaction.id}`);
          }
          
          // Sync messages
          console.log("\n💬 Syncing messages...");
          const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
            orderId: orderId,
            size: "50",
          });
          
          if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
            const messages = chatResponse.result.result;
            console.log(`Found ${messages.length} messages`);
            
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
                  messageType: "TEXT",
                  isProcessed: false,
                },
                update: {},
              });
            }
            
            // Show recent messages
            console.log("\nRecent messages:");
            for (const msg of messages.slice(-5)) {
              const sender = msg.userId === order.userId ? "US" : "THEM";
              console.log(`[${sender}] ${msg.message}`);
            }
          }
          
          // Check if we need automation
          const ourMessages = await db.prisma.chatMessage.findMany({
            where: { 
              transactionId: transaction.id,
              sender: "us"
            },
          });
          
          if (ourMessages.length === 0 && order.status === 10) {
            console.log("\n🤖 Starting chat automation...");
            await chatService.startAutomation(transaction.id);
            console.log("✅ Chat automation started!");
            
            // Process messages
            await chatService.processUnprocessedMessages();
            console.log("✅ Processed messages");
          } else {
            console.log(`\n✅ Already have ${ourMessages.length} messages from us`);
          }
          
          return; // Success
        }
      } catch (error: any) {
        console.error("Error:", error.message);
      }
    }
    
    console.log("\n❌ Order not found on any account");
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await db.disconnect();
  }
}

// Get order ID from command line or use the known active order
const orderId = process.argv[2] || "1932450908748996608";
console.log(`Processing order: ${orderId}`);

processOrder(orderId).catch(console.error);