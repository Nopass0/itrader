#!/usr/bin/env bun

import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";
import { ActiveOrdersMonitorService } from "./src/services/activeOrdersMonitor";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function testAutomation() {
  console.log("🧪 Testing automation locally without API calls...\n");

  try {
    // Mock time sync
    console.log("🕐 Mocking time sync...");
    TimeSync.setMockOffset(0);
    
    // Create a test transaction
    console.log("📝 Creating test transaction...");
    
    // First create a test Gate account with unique ID
    const testId = `test_${Date.now()}@example.com`;
    const gateAccount = await db.prisma.gateAccount.create({
      data: {
        accountId: testId,
        email: testId,
        apiKey: "test_key",
        apiSecret: "test_secret",
        isActive: true,
      }
    });
    
    // Then create a test payout
    const payout = await db.prisma.payout.create({
      data: {
        gatePayoutId: Math.floor(Math.random() * 1000000),
        gateAccountId: gateAccount.id,
        wallet: "79123456789",
        bank: { name: "Tinkoff" },
        totalTrader: { "643": 5000 },
        amountTrader: { "643": 5000 },
        status: 5,
        createdAt: new Date(),
      }
    });
    
    // Create a test Bybit account
    const bybitAccount = await db.prisma.bybitAccount.create({
      data: {
        accountId: "test_bybit@example.com",
        apiKey: "test_bybit_key",
        apiSecret: "test_bybit_secret",
        isActive: true,
      }
    });
    
    // Create a test advertisement
    const advertisement = await db.prisma.advertisement.create({
      data: {
        bybitAdId: `test_ad_${Date.now()}`,
        bybitAccountId: bybitAccount.id,
        type: "sell",
        currency: "USDT",
        fiat: "RUB",
        price: 100,
        minAmount: 5000,
        maxAmount: 5000,
        paymentMethods: ["Tinkoff"],
        description: "Test ad",
        isActive: true,
        createdAt: new Date(),
      }
    });
    
    // Create a test transaction
    const transaction = await db.prisma.transaction.create({
      data: {
        payoutId: payout.id,
        advertisementId: advertisement.id,
        status: "waiting_payment",
        orderId: "test_order_123",
        chatStep: 0,
        createdAt: new Date(),
      }
    });
    
    console.log(`✅ Created test transaction ${transaction.id}`);
    
    // Create test chat service
    const mockBybitManager = {
      sendChatMessage: async (transactionId: string, message: string) => {
        console.log(`\n📤 [MOCK] Sending message to transaction ${transactionId}:`);
        console.log(`   "${message}"`);
        
        // Save to database
        await db.saveChatMessage({
          transactionId,
          messageId: `mock_${Date.now()}`,
          sender: "us",
          content: message,
          messageType: "TEXT",
          isProcessed: true,
        });
      }
    };
    
    const chatService = new ChatAutomationService(mockBybitManager as any);
    
    console.log("\n🤖 Starting chat automation...");
    await chatService.startAutomation(transaction.id);
    
    // Simulate user response - positive
    console.log("\n👤 Simulating positive user response...");
    await db.saveChatMessage({
      transactionId: transaction.id,
      messageId: `user_${Date.now()}`,
      sender: "counterparty",
      content: "Да, согласен",
      messageType: "TEXT",
      isProcessed: false,
    });
    
    // Process the message
    await chatService.processUnprocessedMessages();
    
    // Check transaction status
    const updatedTransaction = await db.getTransactionWithDetails(transaction.id);
    console.log(`\n📊 Transaction status: ${updatedTransaction?.status}`);
    
    // Test negative response
    console.log("\n🧪 Testing negative response...");
    
    // Create another test transaction
    const transaction2 = await db.prisma.transaction.create({
      data: {
        payoutId: payout.id,
        advertisementId: advertisement.id,
        status: "waiting_payment",
        orderId: "test_order_456",
        chatStep: 0,
        createdAt: new Date(),
      }
    });
    
    await chatService.startAutomation(transaction2.id);
    
    // Simulate negative response
    console.log("\n👤 Simulating negative user response...");
    await db.saveChatMessage({
      transactionId: transaction2.id,
      messageId: `user_neg_${Date.now()}`,
      sender: "counterparty",
      content: "Нет, не могу",
      messageType: "TEXT",
      isProcessed: false,
    });
    
    await chatService.processUnprocessedMessages();
    
    const updatedTransaction2 = await db.getTransactionWithDetails(transaction2.id);
    console.log(`\n📊 Transaction 2 status: ${updatedTransaction2?.status}`);
    
    // Test unclear response
    console.log("\n🧪 Testing unclear response...");
    
    const transaction3 = await db.prisma.transaction.create({
      data: {
        payoutId: payout.id,
        advertisementId: advertisement.id,
        status: "waiting_payment",
        orderId: "test_order_789",
        chatStep: 0,
        createdAt: new Date(),
      }
    });
    
    await chatService.startAutomation(transaction3.id);
    
    // Simulate unclear response
    console.log("\n👤 Simulating unclear user response...");
    await db.saveChatMessage({
      transactionId: transaction3.id,
      messageId: `user_unclear_${Date.now()}`,
      sender: "counterparty",
      content: "Что? Не понял",
      messageType: "TEXT",
      isProcessed: false,
    });
    
    await chatService.processUnprocessedMessages();
    
    // Check if question was repeated
    const messages3 = await db.getChatMessages(transaction3.id);
    console.log(`\n📨 Total messages in transaction 3: ${messages3.length}`);
    console.log("Last message:", messages3[messages3.length - 1]?.content.substring(0, 50) + "...");
    
    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await db.prisma.chatMessage.deleteMany({ where: { transactionId: { in: [transaction.id, transaction2.id, transaction3.id] } } });
    await db.prisma.transaction.deleteMany({ where: { id: { in: [transaction.id, transaction2.id, transaction3.id] } } });
    await db.prisma.advertisement.delete({ where: { id: advertisement.id } });
    await db.prisma.payout.delete({ where: { id: payout.id } });
    await db.prisma.gateAccount.delete({ where: { id: gateAccount.id } });
    
    console.log("\n✅ Automation test completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await db.disconnect();
  }
}

testAutomation().catch(console.error);