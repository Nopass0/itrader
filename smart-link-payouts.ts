#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Smart linking of payouts to transactions...\n");

  // Get all transactions
  const transactions = await prisma.transaction.findMany({
    include: {
      advertisement: true,
      payout: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Get all unlinked payouts
  const unlinkedPayouts = await prisma.payout.findMany({
    where: {
      status: 5,
      transaction: null,
    },
  });

  console.log(`Found ${transactions.length} transactions and ${unlinkedPayouts.length} unlinked payouts\n`);

  // Process each transaction
  for (const tx of transactions) {
    console.log(`\n📊 Transaction ${tx.id}:`);
    console.log(`   Order: ${tx.orderId || "none"}`);
    console.log(`   Current payout: ${tx.payout?.gatePayoutId || "none"}`);
    console.log(`   Advertisement: ${tx.advertisement?.bybitAdId || "none"}`);
    
    if (!tx.payoutId && tx.advertisement) {
      // Transaction needs a payout
      const adAmount = parseFloat(tx.advertisement.quantity);
      const expectedRub = adAmount * 78.85; // approximate rate
      
      console.log(`   Expected amount: ${expectedRub.toFixed(0)} RUB`);
      
      // Find best matching payout
      let bestMatch = null;
      let bestDiff = Infinity;
      
      for (const payout of unlinkedPayouts) {
        const payoutData = typeof payout.amountTrader === "string" 
          ? JSON.parse(payout.amountTrader) 
          : payout.amountTrader;
        const payoutAmount = payoutData?.["643"] || 0;
        const diff = Math.abs(payoutAmount - expectedRub);
        
        console.log(`   Checking payout ${payout.gatePayoutId}: ${payoutAmount} RUB (diff: ${diff.toFixed(0)})`);
        
        if (diff < bestDiff && diff < 100) { // Allow 100 RUB difference
          bestDiff = diff;
          bestMatch = payout;
        }
      }
      
      if (bestMatch) {
        const payoutData = typeof bestMatch.amountTrader === "string" 
          ? JSON.parse(bestMatch.amountTrader) 
          : bestMatch.amountTrader;
        console.log(`   ✅ Best match: Payout ${bestMatch.gatePayoutId} (${payoutData?.["643"]} RUB)`);
        
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { payoutId: bestMatch.id },
        });
        
        // Remove from unlinked list
        unlinkedPayouts.splice(unlinkedPayouts.indexOf(bestMatch), 1);
      } else {
        console.log(`   ❌ No suitable payout found`);
      }
    }
  }

  // Report remaining unlinked payouts
  console.log("\n📋 Remaining unlinked payouts:");
  for (const payout of unlinkedPayouts) {
    const payoutData = typeof payout.amountTrader === "string" 
      ? JSON.parse(payout.amountTrader) 
      : payout.amountTrader;
    console.log(`- Payout ${payout.gatePayoutId}: ${payoutData?.["643"]} RUB`);
  }

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());