#!/usr/bin/env bun

/**
 * Check if we have advertisement for itemId
 */

import { db } from "../src/db";

async function main() {
  const itemId = "1935036056297000960";
  const orderId = "1935036461250138112";
  
  console.log(`🔍 Checking itemId ${itemId} for order ${orderId}\n`);

  try {
    // Check advertisement
    const ad = await db.prisma.advertisement.findUnique({
      where: { bybitAdId: itemId },
      include: {
        transaction: true,
        payout: true
      }
    });

    if (ad) {
      console.log("✅ Found advertisement:");
      console.log(`  ID: ${ad.id}`);
      console.log(`  Bybit Ad ID: ${ad.bybitAdId}`);
      console.log(`  Status: ${ad.status}`);
      console.log(`  Created: ${ad.createdAt}`);
      
      if (ad.transaction) {
        console.log("\n📦 Transaction:");
        console.log(`  ID: ${ad.transaction.id}`);
        console.log(`  Status: ${ad.transaction.status}`);
        console.log(`  Order ID: ${ad.transaction.orderId || "NOT SET"}`);
        
        if (!ad.transaction.orderId) {
          console.log("\n⚠️  Transaction exists but orderId is not set!");
          console.log("   This is why OrderLinkingService should link them.");
        }
      } else {
        console.log("\n❌ No transaction for this advertisement");
      }
      
      if (ad.payout) {
        console.log("\n💰 Payout:");
        console.log(`  ID: ${ad.payout.id}`);
        console.log(`  Gate Payout ID: ${ad.payout.gatePayoutId}`);
        console.log(`  Amount: ${ad.payout.amountTrader["643"]} RUB`);
      }
    } else {
      console.log("❌ No advertisement found for this itemId");
    }

    // Also check if there's a transaction with this orderId
    const txWithOrder = await db.prisma.transaction.findUnique({
      where: { orderId: orderId },
      include: { advertisement: true }
    });

    if (txWithOrder) {
      console.log(`\n📦 Found transaction with orderId ${orderId}:`);
      console.log(`  Transaction ID: ${txWithOrder.id}`);
      console.log(`  Advertisement: ${txWithOrder.advertisementId}`);
    } else {
      console.log(`\n❌ No transaction found with orderId ${orderId}`);
    }

    await db.disconnect();
    console.log("\n✅ Check complete!");

  } catch (error) {
    console.error("❌ Error:", error);
    await db.disconnect();
    process.exit(1);
  }
}

main();