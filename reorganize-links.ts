#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Reorganizing transaction-payout-advertisement links...\n");

  // Step 1: Clear all transaction-payout links to start fresh
  console.log("Step 1: Clearing all payout links...");
  await prisma.transaction.updateMany({
    data: { payoutId: null },
  });
  console.log("✅ All payout links cleared\n");

  // Step 2: Get all transactions with advertisements
  console.log("Step 2: Analyzing transactions and advertisements...");
  const transactions = await prisma.transaction.findMany({
    include: {
      advertisement: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Step 3: Get all available payouts
  const payouts = await prisma.payout.findMany({
    where: { status: 5 },
  });

  console.log(`Found ${transactions.length} transactions and ${payouts.length} payouts\n`);

  // Step 4: Match transactions to payouts based on advertisement creation order
  const realTransactions = transactions.filter(
    tx => tx.advertisement && !tx.advertisement.bybitAdId?.startsWith("temp_")
  );

  console.log(`Found ${realTransactions.length} transactions with real advertisements:\n`);

  // Sort payouts by creation time to match with transactions
  const sortedPayouts = payouts.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Match by order of creation
  for (let i = 0; i < Math.min(realTransactions.length, sortedPayouts.length); i++) {
    const tx = realTransactions[i];
    const payout = sortedPayouts[i];
    
    const payoutData = typeof payout.amountTrader === "string" 
      ? JSON.parse(payout.amountTrader) 
      : payout.amountTrader;
    const payoutAmount = payoutData?.["643"] || 0;
    
    console.log(`Linking transaction ${tx.id} to payout ${payout.gatePayoutId} (${payoutAmount} RUB)`);
    
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { payoutId: payout.id },
    });
  }

  // Step 5: Report on fake advertisements
  console.log("\n📊 Fake advertisements that need attention:");
  const fakeAds = await prisma.advertisement.findMany({
    where: {
      bybitAdId: { startsWith: "temp_" },
    },
    include: {
      transactions: true,
    },
  });

  for (const ad of fakeAds) {
    console.log(`- ${ad.bybitAdId}: ${ad.quantity} USDT`);
    if (ad.transactions.length > 0) {
      for (const tx of ad.transactions) {
        console.log(`  Linked to transaction ${tx.id} (Order: ${tx.orderId})`);
      }
    }
  }

  // Final report
  console.log("\n📊 Final state:");
  const finalTxs = await prisma.transaction.findMany({
    include: {
      payout: true,
      advertisement: true,
    },
  });

  for (const tx of finalTxs) {
    console.log(`Transaction ${tx.id}:`);
    console.log(`  Order: ${tx.orderId || "none"}`);
    console.log(`  Payout: ${tx.payout ? tx.payout.gatePayoutId : "none"}`);
    console.log(`  Advertisement: ${tx.advertisement?.bybitAdId || "none"}`);
    console.log("");
  }

  console.log("✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());