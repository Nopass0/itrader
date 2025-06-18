import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function checkSpecificOrder(orderId: string) {
  try {
    console.log(`=== Checking Order ${orderId} ===\n`);

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    // Get accounts
    const accounts = await db.getActiveBybitAccounts();
    
    for (const account of accounts) {
      console.log(`\nChecking account: ${account.accountId}`);
      
      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;
      
      const httpClient = (client as any).httpClient;

      try {
        // Get order details
        console.log(`\nFetching order details...`);
        const orderResponse = await httpClient.post("/v5/p2p/order/info", {
          orderId: orderId,
        });
        
        if (orderResponse.ret_code === 0 && orderResponse.result?.result) {
          const order = orderResponse.result.result;
          
          console.log("\n✅ Order found!");
          console.log(`Status: ${order.status} (${getStatusName(order.status)})`);
          console.log(`Side: ${order.side} (${order.side === 1 ? "SELL" : "BUY"})`);
          console.log(`Amount: ${order.amount} ${order.currencyId}`);
          console.log(`Price: ${order.price}`);
          console.log(`Item ID: ${order.itemId}`);
          console.log(`User ID: ${order.userId}`);
          console.log(`Buyer: ${order.buyerNickName} (${order.buyerUserId})`);
          console.log(`Seller: ${order.sellerNickName} (${order.sellerUserId})`);
          
          if (order.transferDate) {
            console.log(`Transfer Date: ${new Date(parseInt(order.transferDate)).toLocaleString()}`);
          }
          
          // Check transaction
          let transaction = await db.getTransactionByOrderId(orderId);
          
          if (!transaction) {
            console.log("\n❌ No transaction found in database");
            console.log("Creating transaction...");
            
            // Find or create advertisement
            let advertisement = await db.prisma.advertisement.findFirst({
              where: {
                bybitAdId: order.itemId,
                bybitAccountId: account.accountId,
              },
            });
            
            if (!advertisement) {
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
              console.log("✅ Created advertisement");
            }
            
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
            console.log(`Status: ${transaction.status}`);
            console.log(`Chat Step: ${transaction.chatStep}`);
          }
          
          // Check messages
          console.log("\nChecking chat messages...");
          const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
            orderId: orderId,
            size: "50",
          });
          
          if (chatResponse.ret_code === 0 && chatResponse.result?.result) {
            const messages = chatResponse.result.result;
            console.log(`\nFound ${messages.length} chat messages`);
            
            // Sync messages
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
            
            // Check if needs automation
            const dbMessages = await db.prisma.chatMessage.findMany({
              where: { transactionId: transaction.id },
            });
            
            const hasOurMessages = dbMessages.some(m => m.sender === "us");
            
            if (!hasOurMessages && order.status === 10) {
              console.log("\n🤖 No messages from us. Starting chat automation...");
              try {
                await chatService.startAutomation(transaction.id);
                console.log("✅ Chat automation started!");
              } catch (error: any) {
                console.error("❌ Error:", error.message);
              }
            } else if (hasOurMessages) {
              console.log("\n✅ Chat automation already active");
            }
          }
          
          return; // Found the order, exit
        }
      } catch (error: any) {
        if (error.message?.includes("Order does not exist")) {
          console.log("Order not found on this account");
        } else {
          console.error("Error:", error.message);
        }
      }
    }
    
    console.log("\n❌ Order not found on any account");
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
    50: "cancelled",
    60: "completed",
    90: "waiting buyer select tokenId",
    100: "objectioning",
    110: "waiting for user to raise objection",
  };
  return map[status] || "unknown";
}

// Get order ID from command line
const orderId = process.argv[2];
if (!orderId) {
  console.error("Usage: bun run test-order-check.ts <orderId>");
  process.exit(1);
}

checkSpecificOrder(orderId).catch(console.error);