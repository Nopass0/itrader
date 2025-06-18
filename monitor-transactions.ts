#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Monitoring all transactions for amount mismatches...\n");

  const transactions = await prisma.transaction.findMany({
    include: {
      payout: true,
      advertisement: true,
    },
    where: {
      orderId: { not: null },
    },
  });

  let issues = 0;

  for (const tx of transactions) {
    if (!tx.payout || !tx.orderId) continue;

    // Get order details from advertisement
    const adAmount = parseFloat(tx.advertisement?.quantity || "0");
    
    // Get payout amount
    const payoutData = typeof tx.payout.amountTrader === "string" 
      ? JSON.parse(tx.payout.amountTrader) 
      : tx.payout.amountTrader;
    const payoutAmount = payoutData?.["643"] || 0;

    // Check if amounts match
    if (Math.abs(payoutAmount - adAmount) > 1 && adAmount > 0) {
      issues++;
      console.log(`❌ MISMATCH FOUND:`);
      console.log(`   Transaction: ${tx.id}`);
      console.log(`   Order: ${tx.orderId}`);
      console.log(`   Payout: ${tx.payout.gatePayoutId} (${payoutAmount} RUB)`);
      console.log(`   Advertisement amount: ${adAmount} RUB`);
      console.log(`   Difference: ${Math.abs(payoutAmount - adAmount)} RUB`);
      console.log(`   Wallet: ${tx.payout.wallet}`);
      console.log("");
    }
  }

  if (issues === 0) {
    console.log("✅ All transactions have matching amounts!");
  } else {
    console.log(`\n⚠️  Found ${issues} transaction(s) with amount mismatches`);
  }

  // Check for orphaned payouts
  console.log("\n📋 Checking for orphaned payouts (status 5 without transactions):");
  const orphanedPayouts = await prisma.payout.findMany({
    where: {
      status: 5,
      transaction: null,
    },
  });

  if (orphanedPayouts.length > 0) {
    console.log(`Found ${orphanedPayouts.length} orphaned payouts:`);
    for (const payout of orphanedPayouts) {
      const amount = typeof payout.amountTrader === "string" 
        ? JSON.parse(payout.amountTrader) 
        : payout.amountTrader;
      console.log(`   Payout ${payout.gatePayoutId}: ${amount?.["643"]} RUB to ${payout.wallet}`);
    }
  } else {
    console.log("   ✅ No orphaned payouts found");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());