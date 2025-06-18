import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";

async function testSendMessage() {
  try {
    console.log("=== Testing Message Sending ===\n");

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    // Get a test order ID and transaction
    const orderId = process.argv[2];
    const transactionId = process.argv[3];
    
    if (!orderId || !transactionId) {
      console.log("Usage: bun run test-send-message.ts <orderId> <transactionId>");
      console.log("\nChecking for existing transactions with orders...");
      
      const transactions = await db.prisma.transaction.findMany({
        where: { orderId: { not: null } },
        include: { advertisement: true },
      });
      
      if (transactions.length > 0) {
        console.log("\nFound transactions:");
        for (const tx of transactions) {
          console.log(`  Transaction: ${tx.id}, Order: ${tx.orderId}, Account: ${tx.advertisement.bybitAccountId}`);
        }
      } else {
        console.log("\nNo transactions with orders found.");
      }
      
      await db.disconnect();
      return;
    }

    console.log(`Testing with Order ID: ${orderId}, Transaction ID: ${transactionId}`);

    // Get transaction details
    const transaction = await db.getTransactionWithDetails(transactionId);
    if (!transaction) {
      console.error("Transaction not found!");
      await db.disconnect();
      return;
    }

    const accountId = transaction.advertisement.bybitAccountId;
    console.log(`Using account: ${accountId}`);

    // Test direct message sending
    const client = bybitManager.getClient(accountId);
    if (!client) {
      console.error("No client found for account!");
      await db.disconnect();
      return;
    }

    const httpClient = (client as any).httpClient;
    
    // Generate msgUuid
    const msgUuid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const testMessage = "Тест сообщения " + new Date().toLocaleTimeString();
    
    console.log("\nSending test message...");
    console.log(`Message: ${testMessage}`);
    console.log(`MsgUuid: ${msgUuid}`);
    
    try {
      const response = await httpClient.post("/v5/p2p/order/message/send", {
        orderId: orderId,
        message: testMessage,
        contentType: "str",
        msgUuid: msgUuid,
      });
      
      console.log("\nResponse:", JSON.stringify(response, null, 2));
      
      if (response.ret_code === 0) {
        console.log("✅ Message sent successfully!");
        
        // Save to database
        await db.createChatMessage({
          transactionId: transactionId,
          messageId: `sent_${msgUuid}`,
          sender: "us",
          content: testMessage,
          messageType: "TEXT",
        });
        
        console.log("✅ Message saved to database!");
      } else {
        console.error("❌ Failed to send message:", response.ret_msg);
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
    }

    // Check chat messages
    console.log("\nChecking chat messages...");
    const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
      orderId: orderId,
      size: "10",
    });
    
    if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
      console.log(`Found ${chatResponse.result.result.length} messages:`);
      for (const msg of chatResponse.result.result.slice(0, 5)) {
        console.log(`  [${msg.userId}] ${msg.message}`);
      }
    }

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await db.disconnect();
  }
}

testSendMessage().catch(console.error);