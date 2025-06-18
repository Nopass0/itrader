#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Fixing orphaned transactions...\n");

  // Find transactions with non-existent payouts
  const transactions = await prisma.transaction.findMany({
    where: {
      payoutId: { not: null },
    },
    include: {
      payout: true,
      advertisement: true,
    },
  });

  for (const tx of transactions) {
    if (!tx.payout) {
      console.log(`❌ Transaction ${tx.id} references non-existent payout ${tx.payoutId}`);
      
      // Clear the invalid payout reference
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { payoutId: null },
      });
      
      console.log("   ✅ Cleared invalid payout reference");
      
      // Try to find correct payout if order exists
      if (tx.orderId && tx.advertisement) {
        const adAmount = parseFloat(tx.advertisement.quantity);
        const expectedRub = adAmount * 78.85;
        
        console.log(`   Looking for payout matching ${expectedRub.toFixed(0)} RUB...`);
        
        const payouts = await prisma.payout.findMany({
          where: {
            status: 5,
            transaction: null,
          },
        });
        
        let bestMatch = null;
        let bestDiff = Infinity;
        
        for (const payout of payouts) {
          const payoutData = typeof payout.amountTrader === "string" 
            ? JSON.parse(payout.amountTrader) 
            : payout.amountTrader;
          const payoutAmount = payoutData?.["643"] || 0;
          const diff = Math.abs(payoutAmount - expectedRub);
          
          if (diff < bestDiff && diff < 50) {
            bestDiff = diff;
            bestMatch = payout;
          }
        }
        
        if (bestMatch) {
          const payoutData = typeof bestMatch.amountTrader === "string" 
            ? JSON.parse(bestMatch.amountTrader) 
            : bestMatch.amountTrader;
          console.log(`   ✅ Found matching payout ${bestMatch.gatePayoutId} (${payoutData?.["643"]} RUB)`);
          
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { payoutId: bestMatch.id },
          });
          
          console.log("   ✅ Linked to correct payout");
        } else {
          console.log("   ❌ No matching payout found");
        }
      }
    }
  }

  // Also check transactions without payouts but with orders
  console.log("\n🔍 Checking transactions with orders but no payouts...");
  
  const txWithoutPayouts = await prisma.transaction.findMany({
    where: {
      orderId: { not: null },
      payoutId: null,
    },
    include: {
      advertisement: true,
    },
  });

  console.log(`Found ${txWithoutPayouts.length} transaction(s) with orders but no payouts`);
  
  for (const tx of txWithoutPayouts) {
    console.log(`\n- Transaction ${tx.id} (Order: ${tx.orderId})`);
    
    if (tx.advertisement?.bybitAdId?.startsWith("temp_")) {
      console.log("  ⚠️ Has fake advertisement");
    }
  }

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());