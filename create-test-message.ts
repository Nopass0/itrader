import { db } from "./src/db";

async function createTestMessage() {
  try {
    console.log("Creating test message...");
    
    // Get an active transaction
    const transactions = await db.getActiveTransactions();
    const transaction = transactions.find(t => t.orderId && t.chatStep === 1);
    
    if (!transaction) {
      console.log("No suitable transaction found");
      return;
    }
    
    console.log("Using transaction:", {
      id: transaction.id,
      orderId: transaction.orderId,
      chatStep: transaction.chatStep
    });
    
    // Create a message from counterparty
    const message = await db.createChatMessage({
      transactionId: transaction.id,
      messageId: `test_msg_${Date.now()}`,
      sender: "counterparty",
      content: "Да",
      messageType: "TEXT",
      isProcessed: false
    });
    
    console.log("Created message:", {
      id: message.id,
      transactionId: message.transactionId,
      sender: message.sender,
      content: message.content,
      isProcessed: message.isProcessed
    });
    
    // Check unprocessed messages
    const unprocessed = await db.getUnprocessedChatMessages();
    console.log("Total unprocessed messages:", unprocessed.length);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.prisma.$disconnect();
  }
}

createTestMessage();