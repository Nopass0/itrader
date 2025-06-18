#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Fixing transactions without payouts...");

  // Find all transactions without payouts
  const transactionsWithoutPayouts = await prisma.transaction.findMany({
    where: {
      payoutId: null,
    },
    include: {
      advertisement: true,
    },
  });

  console.log(`Found ${transactionsWithoutPayouts.length} transactions without payouts`);

  for (const transaction of transactionsWithoutPayouts) {
    console.log(`\n📍 Transaction ${transaction.id}:`);
    console.log(`   Advertisement: ${transaction.advertisement?.bybitAdId}`);
    console.log(`   Order: ${transaction.orderId}`);
    
    // Try to find a matching payout by advertisement creation time
    if (transaction.advertisement) {
      const payouts = await prisma.payout.findMany({
        where: {
          status: 5,
          createdAt: {
            // Look for payouts created around the same time as the advertisement
            gte: new Date(transaction.advertisement.createdAt.getTime() - 5 * 60 * 1000), // 5 minutes before
            lte: new Date(transaction.advertisement.createdAt.getTime() + 5 * 60 * 1000), // 5 minutes after
          },
        },
      });

      console.log(`   Found ${payouts.length} payouts created around the same time`);

      if (payouts.length === 1) {
        // If only one payout found, it's likely the correct one
        const payout = payouts[0];
        console.log(`   ✅ Linking to payout ${payout.gatePayoutId} (${payout.amountTrader})`);
        
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { payoutId: payout.id },
        });
      } else if (payouts.length > 1) {
        console.log(`   ⚠️  Multiple payouts found, manual intervention needed`);
        for (const payout of payouts) {
          const amount = typeof payout.amountTrader === "string" 
            ? JSON.parse(payout.amountTrader) 
            : payout.amountTrader;
          console.log(`      - Payout ${payout.gatePayoutId}: ${amount?.["643"]} RUB to ${payout.wallet}`);
        }
      }
    }
  }

  // Show current state
  console.log("\n📊 Current database state:");
  
  const allTransactions = await prisma.transaction.findMany({
    include: {
      payout: true,
      advertisement: true,
    },
  });

  for (const transaction of allTransactions) {
    const payoutInfo = transaction.payout 
      ? `Payout ${transaction.payout.gatePayoutId} (${transaction.payout.wallet})`
      : "NO PAYOUT";
    
    console.log(`Transaction ${transaction.id}: ${payoutInfo} | Order: ${transaction.orderId || "none"}`);
  }

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());