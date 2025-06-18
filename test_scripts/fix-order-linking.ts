#!/usr/bin/env bun

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { TimeSync } from "../src/bybit/utils/timeSync";
import { createLogger } from "../src/logger";

const logger = createLogger("FixOrderLinking");

async function fixOrderLinking() {
  try {
    console.log("🔧 Fixing Order Linking\n");

    // Force time sync first
    await TimeSync.forceSync();

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    // Check the specific advertisement
    const itemId = "1935036056297000960";
    const orderId = "1935036461250138112";

    console.log(`📋 Checking advertisement with bybitAdId: ${itemId}`);
    
    const advertisement = await db.prisma.advertisement.findUnique({
      where: { bybitAdId: itemId },
      include: { 
        transaction: true,
        payout: true,
      },
    });

    if (!advertisement) {
      console.log("❌ Advertisement not found!");
      return;
    }

    console.log("\n✅ Advertisement found:");
    console.log(`  DB ID: ${advertisement.id}`);
    console.log(`  Account: ${advertisement.bybitAccountId}`);
    console.log(`  Status: ${advertisement.status}`);
    console.log(`  Payment Method: ${advertisement.paymentMethod}`);
    console.log(`  Payout ID: ${advertisement.payoutId || 'NONE'}`);

    if (advertisement.transaction) {
      console.log("\n📋 Transaction details:");
      console.log(`  Transaction ID: ${advertisement.transaction.id}`);
      console.log(`  Order ID: ${advertisement.transaction.orderId || 'NONE'}`);
      console.log(`  Status: ${advertisement.transaction.status}`);
      console.log(`  Payout ID: ${advertisement.transaction.payoutId || 'NONE'}`);

      if (!advertisement.transaction.orderId) {
        console.log("\n🔧 Updating transaction with orderId...");
        
        const updated = await db.prisma.transaction.update({
          where: { id: advertisement.transaction.id },
          data: {
            orderId: orderId,
            status: "chat_started",
            updatedAt: new Date(),
          },
        });

        console.log("✅ Transaction updated!");
        console.log(`  Transaction ID: ${updated.id}`);
        console.log(`  Order ID: ${updated.orderId}`);
        console.log(`  Status: ${updated.status}`);

        // Emit the ORDER_CREATED event manually
        console.log("\n📡 Manually emitting ORDER_CREATED event...");
        const payoutService = bybitManager.getPayoutAdvertisingService();
        
        try {
          const linkedTransaction = await payoutService.linkOrderToTransaction(
            itemId,
            orderId,
            78.00 // Price from the order details
          );
          
          console.log("✅ Order linked successfully!");
          console.log(`  Transaction ID: ${linkedTransaction.id}`);
          console.log(`  Payout ID: ${linkedTransaction.payoutId}`);
        } catch (error) {
          console.log("⚠️  linkOrderToTransaction failed (transaction already has orderId)");
        }

        // Start chat polling for this order
        console.log("\n💬 Starting chat polling...");
        try {
          await bybitManager.startChatPolling(updated.id);
          console.log("✅ Chat polling started!");
        } catch (error) {
          console.error("❌ Failed to start chat polling:", error.message);
        }
      } else {
        console.log("\n✅ Transaction already has orderId linked!");
      }
    } else {
      console.log("\n❌ No transaction found for this advertisement!");
      
      // Create transaction if missing
      if (advertisement.payoutId) {
        console.log("🔧 Creating transaction...");
        
        const newTransaction = await db.prisma.transaction.create({
          data: {
            payoutId: advertisement.payoutId,
            advertisementId: advertisement.id,
            orderId: orderId,
            status: "chat_started",
          },
        });
        
        console.log("✅ Transaction created!");
        console.log(`  Transaction ID: ${newTransaction.id}`);
        console.log(`  Order ID: ${newTransaction.orderId}`);
      }
    }

    // Check if we need to start chat automation
    console.log("\n🤖 Checking if chat automation is needed...");
    
    const messages = await db.prisma.chatMessage.findMany({
      where: { 
        transaction: {
          orderId: orderId,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${messages.length} chat messages`);
    
    const hasOurMessages = messages.some(m => m.sender === "us");
    
    if (!hasOurMessages) {
      console.log("⚠️  No messages from us yet. You may want to start chat automation.");
    } else {
      console.log("✅ Already have messages from us");
    }

    console.log("\n✅ Fix complete!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

fixOrderLinking().catch(console.error);