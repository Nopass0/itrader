#!/usr/bin/env bun

import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { ChatAutomationService } from "./src/services/chatAutomation";

async function testChatAutomation() {
  try {
    console.log("🔍 Testing Chat Automation for Active Orders\n");
    console.log("=" .repeat(60) + "\n");

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    // Get all active orders
    console.log("1. Getting all active orders...");
    const activeOrders = await bybitManager.getAllActiveOrders();
    console.log(`Found ${activeOrders.length} active orders\n`);

    if (activeOrders.length === 0) {
      console.log("No active orders found. Checking for orders another way...");
      
      // Try to get orders for each account
      const accounts = await db.getActiveBybitAccounts();
      for (const account of accounts) {
        const client = bybitManager.getClient(account.accountId);
        if (!client) continue;
        
        const httpClient = (client as any).httpClient;
        
        // Try without status filter
        const response = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 50,
        });
        
        console.log(`Orders for account ${account.accountId}:`, JSON.stringify(response.result, null, 2));
      }
      
      await db.disconnect();
      return;
    }

    // Process each order
    for (const order of activeOrders) {
      console.log(`\n--- Processing Order ${order.id} ---`);
      console.log(`Status: ${order.status}`);
      console.log(`Amount: ${order.amount} ${order.currencyId}`);
      console.log(`Account: ${order.bybitAccountId}`);

      // Get full order details
      const orderDetails = await bybitManager.getOrderDetails(order.id, order.bybitAccountId);
      console.log(`Order type: ${orderDetails.side === 1 ? "SELL" : "BUY"}`);
      console.log(`Advertisement ID: ${orderDetails.itemId}`);

      // Check if transaction exists
      const existingTransaction = await db.getTransactionByOrderId(order.id);
      
      if (!existingTransaction) {
        console.log("No transaction found for this order. Creating...");
        
        // Find or create advertisement
        let advertisement = await db.prisma.advertisement.findFirst({
          where: {
            bybitAdId: orderDetails.itemId,
          },
        });
        
        if (!advertisement) {
          console.log("Creating minimal advertisement...");
          advertisement = await db.prisma.advertisement.create({
            data: {
              bybitAdId: orderDetails.itemId,
              bybitAccountId: order.bybitAccountId,
              side: orderDetails.side === 1 ? "SELL" : "BUY",
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
        
        // Create transaction
        const transaction = await db.prisma.transaction.create({
          data: {
            advertisementId: advertisement.id,
            orderId: order.id,
            status: order.status === 10 ? "chat_started" : 
                   order.status === 20 ? "waiting_payment" : "pending",
            chatStep: 0,
          },
        });
        
        console.log(`Created transaction ${transaction.id}`);
        
        // Start automation for status 10
        if (order.status === 10) {
          console.log("Starting chat automation...");
          try {
            await chatService.startAutomation(transaction.id);
            console.log("✅ Chat automation started successfully!");
          } catch (error) {
            console.error("❌ Error starting chat automation:", error);
          }
        }
      } else {
        console.log(`Transaction ${existingTransaction.id} already exists`);
        
        // Check chat messages
        const messages = await db.prisma.chatMessage.findMany({
          where: { transactionId: existingTransaction.id },
          orderBy: { createdAt: "asc" },
        });
        
        console.log(`Found ${messages.length} messages in chat`);
        
        if (messages.length === 0 && order.status === 10) {
          console.log("No messages yet, starting automation...");
          try {
            await chatService.startAutomation(existingTransaction.id);
            console.log("✅ Chat automation started successfully!");
          } catch (error) {
            console.error("❌ Error starting chat automation:", error);
          }
        }
        
        // Process unprocessed messages
        const unprocessedMessages = messages.filter(m => m.sender === "counterparty" && !m.isProcessed);
        if (unprocessedMessages.length > 0) {
          console.log(`Processing ${unprocessedMessages.length} unprocessed messages...`);
          await chatService.processUnprocessedMessages();
        }
      }
      
      // Show chat messages
      const client = bybitManager.getClient(order.bybitAccountId);
      const httpClient = (client as any).httpClient;
      
      const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
        orderId: order.id,
        size: "20",
      });
      
      if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
        console.log(`\nChat messages (${chatResponse.result.result.length}):`);
        for (const msg of chatResponse.result.result.slice(0, 5)) {
          const sender = msg.userId === orderDetails.userId ? "US" : "THEM";
          console.log(`[${sender}] ${msg.message}`);
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

// Run test
testChatAutomation().catch(console.error);