#!/usr/bin/env bun

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { TimeSync } from "../src/bybit/utils/timeSync";
import { createLogger } from "../src/logger";

const logger = createLogger("TestOrderLinking");

async function testOrderLinkingService() {
  try {
    console.log("🔍 Testing Order Linking Service\n");

    // Force time sync first
    await TimeSync.forceSync();

    // Initialize Bybit manager (this will start the OrderLinkingService)
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    console.log("✅ BybitP2PManagerService initialized");
    console.log("✅ OrderLinkingService started (checking every 30 seconds)");
    console.log("\n📋 Current status:");

    // Check current advertisements
    const advertisements = await db.prisma.advertisement.findMany({
      where: { status: "ONLINE" },
      include: { transaction: true },
    });

    console.log(`\nActive advertisements: ${advertisements.length}`);
    for (const ad of advertisements) {
      console.log(`  - ${ad.id}`);
      console.log(`    Bybit Ad ID: ${ad.bybitAdId}`);
      console.log(`    Transaction: ${ad.transaction?.id || 'NONE'}`);
      console.log(`    Order ID: ${ad.transaction?.orderId || 'NONE'}`);
    }

    // Check active orders
    const activeOrders = await bybitManager.getAllActiveOrders();
    console.log(`\nActive orders from Bybit: ${activeOrders.length}`);
    for (const order of activeOrders) {
      console.log(`  - Order ${order.id}`);
      console.log(`    Status: ${order.status}`);
      console.log(`    Account: ${order.bybitAccountId}`);
    }

    // Check transactions without orders
    const txWithoutOrders = await db.prisma.transaction.findMany({
      where: { orderId: null },
      include: { advertisement: true },
    });

    console.log(`\nTransactions without orders: ${txWithoutOrders.length}`);
    for (const tx of txWithoutOrders) {
      console.log(`  - ${tx.id}`);
      console.log(`    Advertisement: ${tx.advertisementId}`);
      console.log(`    Bybit Ad ID: ${tx.advertisement.bybitAdId}`);
      console.log(`    Status: ${tx.status}`);
    }

    console.log("\n✅ OrderLinkingService is running in the background");
    console.log("It will automatically link any new orders to their transactions");
    console.log("\nPress Ctrl+C to stop\n");

    // Monitor for a while
    let secondsElapsed = 0;
    const monitorInterval = setInterval(async () => {
      secondsElapsed += 10;
      
      // Check if any orders got linked
      const updatedTx = await db.prisma.transaction.findMany({
        where: { 
          orderId: { not: null },
          updatedAt: { gt: new Date(Date.now() - 60000) }, // Updated in last minute
        },
      });

      if (updatedTx.length > 0) {
        console.log(`\n🎉 ${updatedTx.length} orders were linked in the last minute!`);
        for (const tx of updatedTx) {
          console.log(`  - Transaction ${tx.id} linked to order ${tx.orderId}`);
        }
      } else if (secondsElapsed % 30 === 0) {
        console.log(`⏱️  ${secondsElapsed} seconds elapsed... Still monitoring...`);
      }
    }, 10000);

    // Keep running until interrupted
    await new Promise((resolve) => {
      process.on('SIGINT', async () => {
        clearInterval(monitorInterval);
        console.log("\n\nShutting down...");
        await bybitManager.shutdown();
        await db.disconnect();
        resolve(null);
      });
    });

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testOrderLinkingService().catch(console.error);