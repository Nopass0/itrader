import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function testUpdatedMonitor() {
  try {
    console.log("=== Testing Updated Order Monitor ===\n");

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    // Test the updated getAllActiveOrders method
    console.log("Testing getAllActiveOrders method...\n");
    
    const activeOrders = await bybitManager.getAllActiveOrders();
    
    console.log(`\nTotal active orders found: ${activeOrders.length}`);
    
    if (activeOrders.length > 0) {
      console.log("\nProcessing active orders:");
      
      for (const order of activeOrders) {
        console.log(`\n--- Order ${order.id} ---`);
        console.log(`Status: ${order.status}`);
        console.log(`Amount: ${order.amount} ${order.currencyId}`);
        console.log(`Account: ${order.bybitAccountId}`);
        
        // Check if transaction exists
        let transaction = await db.getTransactionByOrderId(order.id);
        
        if (!transaction) {
          console.log("No transaction found, need to create one");
          
          // Get order details
          try {
            const orderDetails = await bybitManager.getOrderDetails(order.id, order.bybitAccountId);
            console.log(`Ad ID: ${orderDetails.itemId}`);
            
            // Find or create advertisement
            let advertisement = await db.prisma.advertisement.findFirst({
              where: {
                bybitAdId: orderDetails.itemId,
                bybitAccountId: order.bybitAccountId,
              },
            });
            
            if (!advertisement) {
              console.log("Creating advertisement...");
              advertisement = await db.prisma.advertisement.create({
                data: {
                  bybitAdId: orderDetails.itemId,
                  bybitAccountId: order.bybitAccountId,
                  side: orderDetails.side === 1 ? "SELL" : "BUY",
                  asset: orderDetails.tokenId || "USDT",
                  fiatCurrency: orderDetails.currencyId || "RUB",
                  price: orderDetails.price || "0",
                  quantity: orderDetails.quantity || "0",
                  minOrderAmount: orderDetails.amount || "0",
                  maxOrderAmount: orderDetails.amount || "0",
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
                status: order.status === 10 ? "chat_started" : "waiting_payment",
                chatStep: 0,
              },
            });
            
            console.log(`Created transaction ${transaction.id}`);
            
            // Start chat automation if needed
            if (order.status === 10) {
              console.log("Starting chat automation...");
              try {
                await chatService.startAutomation(transaction.id);
                console.log("✅ Chat automation started!");
              } catch (error: any) {
                console.error("❌ Error:", error.message);
              }
            }
          } catch (error) {
            console.error("Error processing order:", error);
          }
        } else {
          console.log(`Transaction ${transaction.id} already exists`);
          
          // Check if needs automation
          const messages = await db.prisma.chatMessage.findMany({
            where: { transactionId: transaction.id },
          });
          
          const hasOurMessages = messages.some(m => m.sender === "us");
          
          if (!hasOurMessages && order.status === 10) {
            console.log("No messages from us, starting automation...");
            try {
              await chatService.startAutomation(transaction.id);
              console.log("✅ Chat automation started!");
            } catch (error: any) {
              console.error("❌ Error:", error.message);
            }
          }
        }
      }
    } else {
      console.log("\nNo active orders found. This could be because:");
      console.log("1. There are no orders with status 5, 10, or 20");
      console.log("2. The API is returning count but empty items array");
      console.log("3. Orders might be in a different status");
      
      // Let's check what the API actually returns
      console.log("\nDebug: Checking raw API responses...");
      
      const accounts = await db.getActiveBybitAccounts();
      for (const account of accounts) {
        const client = bybitManager.getClient(account.accountId);
        if (!client) continue;
        
        console.log(`\nAccount ${account.accountId}:`);
        
        // Check getOrders
        try {
          const orders = await client.getOrders(1, 10);
          console.log(`- getOrders: count=${orders.totalCount || orders.total}, items=${orders.list?.length || 0}`);
          if (orders.list && orders.list.length > 0) {
            console.log(`  First order: ID=${orders.list[0].id}, Status=${orders.list[0].status}`);
          }
        } catch (error: any) {
          console.log(`- getOrders error: ${error.message}`);
        }
        
        // Check getPendingOrders
        try {
          const pending = await client.getPendingOrders(1, 10);
          console.log(`- getPendingOrders: count=${pending.totalCount || pending.total}, items=${pending.list?.length || 0}`);
        } catch (error: any) {
          console.log(`- getPendingOrders error: ${error.message}`);
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

testUpdatedMonitor().catch(console.error);