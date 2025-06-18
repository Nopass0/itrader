#!/usr/bin/env bun

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { createLogger } from "../src/logger";

const logger = createLogger("DebugOrderLinking");

async function debugOrderLinking() {
  try {
    console.log("🔍 Debugging Order Linking Issue\n");

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    // 1. Check all advertisements in DB
    console.log("\n📋 All Advertisements in Database:");
    console.log("=" .repeat(60));
    
    const advertisements = await db.prisma.advertisement.findMany({
      include: {
        transaction: true,
        payout: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const ad of advertisements) {
      console.log(`\nAdvertisement: ${ad.id}`);
      console.log(`  Bybit Ad ID: ${ad.bybitAdId}`);
      console.log(`  Account ID: ${ad.bybitAccountId}`);
      console.log(`  Status: ${ad.status}`);
      console.log(`  Payment: ${ad.paymentMethod}`);
      console.log(`  Transaction: ${ad.transaction?.id || 'NONE'}`);
      console.log(`  Order ID: ${ad.transaction?.orderId || 'NONE'}`);
      console.log(`  Created: ${ad.createdAt.toLocaleString()}`);
    }

    // 2. Check active orders from Bybit
    console.log("\n\n📋 Active Orders from Bybit:");
    console.log("=" .repeat(60));

    const activeOrders = await bybitManager.getAllActiveOrders();
    
    for (const order of activeOrders) {
      console.log(`\nOrder: ${order.id}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Account: ${order.bybitAccountId}`);
      console.log(`  Amount: ${order.amount} ${order.currencyId}`);
      console.log(`  Side: ${order.side} (${order.side === 1 ? "SELL" : "BUY"})`);
      
      // Try to get more details
      try {
        const details = await bybitManager.getOrderDetails(order.id, order.bybitAccountId);
        console.log(`  Item ID (Ad ID): ${details.itemId}`);
        console.log(`  User ID: ${details.userId}`);
        console.log(`  Target User: ${details.targetUserId}`);
        console.log(`  Payment Type: ${details.paymentType}`);
        
        // Check if we have an advertisement for this itemId
        const ad = await db.prisma.advertisement.findUnique({
          where: { bybitAdId: details.itemId },
          include: { transaction: true },
        });
        
        if (ad) {
          console.log(`  ✅ Found matching advertisement!`);
          console.log(`     DB Ad ID: ${ad.id}`);
          console.log(`     Transaction: ${ad.transaction?.id || 'NONE'}`);
        } else {
          console.log(`  ❌ No matching advertisement found for itemId: ${details.itemId}`);
          
          // Check if there's any ad with similar bybitAccountId
          const accountAds = await db.prisma.advertisement.findMany({
            where: { 
              bybitAccountId: order.bybitAccountId,
              status: "ONLINE",
            },
          });
          
          console.log(`  📌 Active ads for this account: ${accountAds.length}`);
          for (const accountAd of accountAds) {
            console.log(`     - Ad ${accountAd.id}: bybitAdId = ${accountAd.bybitAdId}`);
          }
        }
        
      } catch (error) {
        console.error(`  ⚠️ Error getting order details: ${error.message}`);
      }
    }

    // 3. Check transactions without orders
    console.log("\n\n📋 Transactions Without Orders:");
    console.log("=" .repeat(60));
    
    const transactionsWithoutOrders = await db.prisma.transaction.findMany({
      where: { orderId: null },
      include: { 
        advertisement: true,
        payout: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const tx of transactionsWithoutOrders) {
      console.log(`\nTransaction: ${tx.id}`);
      console.log(`  Status: ${tx.status}`);
      console.log(`  Advertisement: ${tx.advertisementId}`);
      console.log(`  Bybit Ad ID: ${tx.advertisement.bybitAdId}`);
      console.log(`  Account: ${tx.advertisement.bybitAccountId}`);
      console.log(`  Created: ${tx.createdAt.toLocaleString()}`);
    }

    // 4. Summary
    console.log("\n\n📊 Summary:");
    console.log("=" .repeat(60));
    console.log(`Total Advertisements: ${advertisements.length}`);
    console.log(`Active Orders: ${activeOrders.length}`);
    console.log(`Transactions without Orders: ${transactionsWithoutOrders.length}`);

    console.log("\n✅ Debug complete!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

debugOrderLinking().catch(console.error);