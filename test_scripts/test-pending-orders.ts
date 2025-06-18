import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { ChatAutomationService } from "../src/services/chatAutomation";
import { TimeSync } from "../src/bybit/utils/timeSync";

async function testPendingOrders() {
  try {
    console.log("=== Testing Pending Orders API ===\n");

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

      // Try pending orders endpoint
      console.log("\nTrying /v5/p2p/order/pending/simplifyList...");
      
      try {
        const response = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
          page: 1,
          pageSize: 20,
        });
        
        console.log(`Response code: ${response.ret_code}`);
        console.log(`Response message: ${response.ret_msg}`);
        
        if (response.ret_code === 0 && response.result) {
          console.log(`\nTotal count: ${response.result.count}`);
          
          if (response.result.items && response.result.items.length > 0) {
            console.log(`Found ${response.result.items.length} pending orders!\n`);
            
            for (const order of response.result.items) {
              console.log(`--- Order ${order.id} ---`);
              console.log(`Status: ${order.status} (${getStatusName(order.status)})`);
              console.log(`Side: ${order.side} (${order.side === 1 ? "SELL" : "BUY"})`);
              console.log(`Amount: ${order.amount} ${order.currencyId}`);
              console.log(`Price: ${order.price}`);
              console.log(`Token: ${order.tokenId} (${order.notifyTokenQuantity} ${order.notifyTokenId})`);
              console.log(`Target: ${order.targetNickName} (${order.targetUserId})`);
              console.log(`Created: ${new Date(parseInt(order.createDate)).toLocaleString()}`);
              console.log(`Transfer time left: ${order.transferLastSeconds}s`);
              console.log(`Unread messages: ${order.unreadMsgCount}`);
              
              // Process this order
              if (order.status === 10 || order.status === 20) {
                console.log("\n✅ This is an ACTIVE order! Processing...");
                
                // Get full order details
                const orderDetails = await httpClient.post("/v5/p2p/order/info", {
                  orderId: order.id,
                });
                
                if (orderDetails.ret_code === 0 && orderDetails.result?.result) {
                  const details = orderDetails.result.result;
                  console.log(`Ad ID: ${details.itemId}`);
                  
                  // Check/create transaction
                  let transaction = await db.getTransactionByOrderId(order.id);
                  
                  if (!transaction) {
                    console.log("Creating transaction...");
                    
                    // Find or create advertisement
                    let advertisement = await db.prisma.advertisement.findFirst({
                      where: {
                        bybitAdId: details.itemId,
                        bybitAccountId: account.accountId,
                      },
                    });
                    
                    if (!advertisement) {
                      advertisement = await db.prisma.advertisement.create({
                        data: {
                          bybitAdId: details.itemId,
                          bybitAccountId: account.accountId,
                          side: order.side === 1 ? "SELL" : "BUY",
                          asset: order.tokenId || "USDT",
                          fiatCurrency: order.currencyId || "RUB",
                          price: order.price || "0",
                          quantity: order.amount || "0",
                          minOrderAmount: order.amount || "0",
                          maxOrderAmount: order.amount || "0",
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
                    
                    console.log(`Created transaction ${transaction.id}`);
                  }
                  
                  // Sync chat messages
                  const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
                    orderId: order.id,
                    size: "20",
                  });
                  
                  if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
                    const messages = chatResponse.result.result;
                    console.log(`\nFound ${messages.length} chat messages`);
                    
                    for (const msg of messages) {
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
                    
                    // Show last few messages
                    console.log("\nRecent messages:");
                    for (const msg of messages.slice(-5)) {
                      const sender = msg.userId === details.userId ? "US" : "THEM";
                      console.log(`[${sender}] ${msg.message}`);
                    }
                  }
                  
                  // Check if need to start automation
                  const dbMessages = await db.prisma.chatMessage.findMany({
                    where: { transactionId: transaction.id },
                  });
                  
                  const hasOurMessages = dbMessages.some(m => m.sender === "us");
                  
                  if (!hasOurMessages && order.status === 10) {
                    console.log("\n🤖 Starting chat automation...");
                    try {
                      await chatService.startAutomation(transaction.id);
                      console.log("✅ Chat automation started!");
                    } catch (error: any) {
                      console.error("❌ Error:", error.message);
                    }
                  }
                }
              }
              
              console.log("\n");
            }
          } else {
            console.log("No items in response");
            console.log("Full response:", JSON.stringify(response.result, null, 2));
          }
        }
      } catch (error: any) {
        console.error("Error calling pending orders API:", error.message);
        if (error.details) {
          console.error("Details:", error.details);
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

function getStatusName(status: number): string {
  const map: Record<number, string> = {
    5: "waiting for chain",
    10: "waiting for buyer to pay",
    20: "waiting for seller to release",
    30: "appealing",
    90: "waiting buyer select tokenId",
    100: "objectioning",
    110: "waiting for user to raise objection",
  };
  return map[status] || "unknown";
}

testPendingOrders().catch(console.error);