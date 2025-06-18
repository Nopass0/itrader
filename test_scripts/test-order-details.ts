import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { ChatAutomationService } from "../src/services/chatAutomation";
import { TimeSync } from "../src/bybit/utils/timeSync";

async function testOrderDetails() {
  try {
    console.log("=== Testing Order Details and Chat ===\n");

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
      console.log(`\nChecking account: ${account.accountId}`);
      
      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;
      
      const httpClient = (client as any).httpClient;

      // Get orders using the working API call
      console.log("\nGetting orders...");
      const orders = await client.getOrders(1, 50);
      
      console.log(`Total orders: ${orders.totalCount || orders.total || 0}`);
      
      if (orders.list && orders.list.length > 0) {
        console.log(`\nProcessing ${orders.list.length} orders:`);
        
        for (const order of orders.list) {
          console.log(`\n--- Order ${order.id} ---`);
          console.log(`Status: ${order.status}`);
          console.log(`Side: ${order.side} (${order.side === 1 ? "SELL" : "BUY"})`);
          console.log(`Amount: ${order.amount} ${order.currencyId}`);
          console.log(`Token: ${order.tokenId}`);
          console.log(`Target: ${order.targetNickName}`);
          
          // Get full order details
          try {
            const orderDetails = await httpClient.post("/v5/p2p/order/info", {
              orderId: order.id,
            });
            
            if (orderDetails.result?.result) {
              const details = orderDetails.result.result;
              console.log(`\nOrder Details:`);
              console.log(`- Item ID (Ad ID): ${details.itemId}`);
              console.log(`- Our user ID: ${details.userId}`);
              console.log(`- Target user ID: ${details.targetUserId}`);
              console.log(`- Status: ${details.status}`);
              console.log(`- Payment type: ${details.paymentType}`);
              
              // Check if this is an active order (status 10 or 20)
              if (details.status === 10 || details.status === 20) {
                console.log("\n✅ This is an ACTIVE order!");
                
                // Check if we have a transaction for this order
                let transaction = await db.getTransactionByOrderId(order.id);
                
                if (!transaction) {
                  console.log("No transaction found, creating one...");
                  
                  // Find or create advertisement
                  let advertisement = await db.prisma.advertisement.findFirst({
                    where: {
                      bybitAdId: details.itemId,
                      bybitAccountId: account.accountId,
                    },
                  });
                  
                  if (!advertisement) {
                    console.log("Creating advertisement record...");
                    advertisement = await db.prisma.advertisement.create({
                      data: {
                        bybitAdId: details.itemId,
                        bybitAccountId: account.accountId,
                        side: details.side === 1 ? "SELL" : "BUY",
                        asset: details.tokenId || "USDT",
                        fiatCurrency: details.currencyId || "RUB",
                        price: details.price || "0",
                        quantity: details.quantity || "0",
                        minOrderAmount: details.amount || "0",
                        maxOrderAmount: details.amount || "0",
                        paymentMethod: "Unknown",
                        status: "ONLINE",
                      },
                    });
                  }
                  
                  // Create transaction
                  transaction = await db.prisma.transaction.create({
                    data: {
                      advertisementId: advertisement.id,
                      orderId: order.id,
                      status: details.status === 10 ? "chat_started" : "waiting_payment",
                      chatStep: 0,
                    },
                  });
                  
                  console.log(`Created transaction ${transaction.id}`);
                }
                
                // Check chat messages
                console.log("\nChecking chat messages...");
                const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
                  orderId: order.id,
                  size: "20",
                });
                
                if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
                  console.log(`Found ${chatResponse.result.result.length} messages`);
                  
                  // Save messages to DB
                  for (const msg of chatResponse.result.result) {
                    if (!msg.message) continue;
                    
                    const sender = msg.userId === details.userId ? "us" : "counterparty";
                    
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
                  
                  // Show last 5 messages
                  console.log("\nRecent messages:");
                  for (const msg of chatResponse.result.result.slice(0, 5)) {
                    const sender = msg.userId === details.userId ? "US" : "THEM";
                    console.log(`[${sender}] ${msg.message}`);
                  }
                }
                
                // Check if we need to start automation
                const messages = await db.prisma.chatMessage.findMany({
                  where: { transactionId: transaction.id },
                });
                
                const hasOurMessages = messages.some(m => m.sender === "us");
                
                if (!hasOurMessages && details.status === 10) {
                  console.log("\n🤖 Starting chat automation...");
                  try {
                    await chatService.startAutomation(transaction.id);
                    console.log("✅ Chat automation started!");
                  } catch (error) {
                    console.error("❌ Error starting automation:", error);
                  }
                } else if (hasOurMessages) {
                  console.log("\n✅ Already have messages from us");
                }
              }
            }
          } catch (error) {
            console.error("Error getting order details:", error);
          }
        }
      }
    }

    console.log("\n=== Test Complete ===");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await db.disconnect();
  }
}

testOrderDetails().catch(console.error);