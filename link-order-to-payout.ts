#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const orderId = "1935004145860177920";
  
  console.log(`🔧 Linking order ${orderId} to correct payout...\n`);

  // Get transaction
  const transaction = await prisma.transaction.findFirst({
    where: { orderId },
    include: { advertisement: true },
  });

  if (!transaction) {
    console.log("❌ No transaction found");
    return;
  }

  // Get order amount in USDT
  const orderAmountUsdt = parseFloat(transaction.advertisement?.quantity || "0");
  console.log(`Order amount: ${orderAmountUsdt} USDT`);

  // Convert to RUB (approximate rate)
  const rate = 78.85;
  const expectedRubAmount = orderAmountUsdt * rate;
  console.log(`Expected RUB amount: ${expectedRubAmount.toFixed(0)} RUB`);

  // Find matching payout
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
    
    const diff = Math.abs(payoutAmount - expectedRubAmount);
    console.log(`Payout ${payout.gatePayoutId}: ${payoutAmount} RUB (diff: ${diff.toFixed(0)})`);
    
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = payout;
    }
  }

  if (bestMatch && bestDiff < 100) { // Allow 100 RUB difference
    const payoutData = typeof bestMatch.amountTrader === "string" 
      ? JSON.parse(bestMatch.amountTrader) 
      : bestMatch.amountTrader;
    const payoutAmount = payoutData?.["643"] || 0;
    
    console.log(`\n✅ Best match: Payout ${bestMatch.gatePayoutId} with ${payoutAmount} RUB`);
    console.log(`   Wallet: ${bestMatch.wallet}`);
    
    // Check if payout is already linked
    const existingTx = await prisma.transaction.findFirst({
      where: { payoutId: bestMatch.id },
    });
    
    if (existingTx) {
      console.log(`\n⚠️  Payout is already linked to transaction ${existingTx.id}`);
      return;
    }
    
    // Update transaction
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { payoutId: bestMatch.id },
    });
    
    console.log("✅ Transaction updated with correct payout!");
    
    // Also fix the advertisement if it's fake
    if (transaction.advertisement?.bybitAdId?.startsWith("temp_")) {
      console.log("\n🔧 Fixing fake advertisement...");
      
      // Find real advertisement by amount
      const realAd = await prisma.advertisement.findFirst({
        where: {
          quantity: orderAmountUsdt.toString(),
          bybitAccountId: transaction.advertisement.bybitAccountId,
          bybitAdId: { not: { startsWith: "temp_" } },
        },
      });
      
      if (realAd) {
        console.log(`Found real ad: ${realAd.bybitAdId}`);
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { advertisementId: realAd.id },
        });
        
        // Delete fake ad
        await prisma.advertisement.delete({
          where: { id: transaction.advertisement.id },
        });
        
        console.log("✅ Advertisement fixed!");
      }
    }
  } else {
    console.log("\n❌ No suitable payout found");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());