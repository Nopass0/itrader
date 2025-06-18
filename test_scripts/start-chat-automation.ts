import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { InstantOrderMonitorService } from "./src/services/instantOrderMonitor";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function startChatAutomation() {
  try {
    console.log("=== Starting Chat Automation System ===\n");

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    const instantMonitor = new InstantOrderMonitorService(bybitManager, chatService);

    // First, manually check for the known order
    const orderId = "1932450908748996608";
    console.log(`\n1️⃣ Manually processing order ${orderId}...\n`);
    
    const accounts = await db.getActiveBybitAccounts();
    for (const account of accounts) {
      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;
      
      const httpClient = (client as any).httpClient;
      
      try {
        // Get order info
        const orderResponse = await httpClient.post("/v5/p2p/order/info", {
          orderId: orderId,
        });
        
        if (orderResponse.ret_code === 0 && orderResponse.result?.result) {
          const order = orderResponse.result.result;
          console.log(`✅ Order found! Status: ${order.status}`);
          
          // Create transaction if needed
          let transaction = await db.getTransactionByOrderId(orderId);
          if (!transaction) {
            // Create minimal records
            const ad = await db.prisma.advertisement.create({
              data: {
                bybitAdId: order.itemId,
                bybitAccountId: account.accountId,
                side: "SELL",
                asset: "USDT",
                fiatCurrency: "RUB",
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
                advertisementId: ad.id,
                orderId: orderId,
                status: "chat_started",
                chatStep: 0,
              },
            });
            console.log(`✅ Created transaction ${transaction.id}`);
          }
          
          // Sync messages
          const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
            orderId: orderId,
            size: "50",
          });
          
          if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
            console.log(`\n💬 Found ${chatResponse.result.result.length} messages`);
            
            for (const msg of chatResponse.result.result) {
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
          }
          
          // Start automation
          const ourMessages = await db.prisma.chatMessage.findMany({
            where: { transactionId: transaction.id, sender: "us" },
          });
          
          if (ourMessages.length === 0) {
            console.log("\n🤖 Starting chat automation...");
            await chatService.startAutomation(transaction.id);
            console.log("✅ Initial message sent!");
          }
          
          break;
        }
      } catch (error: any) {
        console.error("Error:", error.message);
      }
    }

    // Start instant monitor
    console.log("\n2️⃣ Starting instant order monitor...\n");
    await instantMonitor.start();

    console.log("Monitor is running. It will:");
    console.log("- Check for orders every second");
    console.log("- Process chat messages instantly");
    console.log("- Send automated responses");
    console.log("\nPress Ctrl+C to stop\n");

    // Keep running
    await new Promise(() => {});
  } catch (error) {
    console.error("Failed:", error);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await db.disconnect();
  process.exit(0);
});

startChatAutomation().catch(console.error);