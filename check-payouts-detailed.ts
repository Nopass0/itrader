#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Detailed check of payouts...\n");

  // Get all payouts
  const payouts = await prisma.payout.findMany({
    include: {
      transaction: true,
    },
  });

  // Map payout IDs to gate IDs and amounts
  const payoutMap = new Map();
  for (const payout of payouts) {
    const amount = typeof payout.amountTrader === "string" 
      ? JSON.parse(payout.amountTrader) 
      : payout.amountTrader;
    payoutMap.set(payout.id, {
      gateId: payout.gatePayoutId,
      amount: amount?.["643"],
      wallet: payout.wallet,
    });
  }

  // Check transaction with order 1935000648602411008
  const problematicTx = await prisma.transaction.findFirst({
    where: { orderId: "1935000648602411008" },
  });

  if (problematicTx && problematicTx.payoutId) {
    const payoutInfo = payoutMap.get(problematicTx.payoutId);
    console.log("📊 Order 1935000648602411008:");
    console.log(`   Transaction ID: ${problematicTx.id}`);
    console.log(`   Payout ID (internal): ${problematicTx.payoutId}`);
    console.log(`   Gate Payout ID: ${payoutInfo?.gateId}`);
    console.log(`   Amount: ${payoutInfo?.amount} RUB`);
    console.log(`   Wallet: ${payoutInfo?.wallet}`);
    console.log(`   ⚠️  Expected amount: 2304 RUB`);
    
    if (payoutInfo?.amount !== 2304) {
      console.log("\n❌ WRONG PAYOUT LINKED!");
      
      // Find the correct payout with 2304 RUB
      for (const [payoutId, info] of payoutMap) {
        if (info.amount === 2304) {
          console.log(`\n✅ Correct payout found:`);
          console.log(`   Payout ID (internal): ${payoutId}`);
          console.log(`   Gate Payout ID: ${info.gateId}`);
          console.log(`   Amount: ${info.amount} RUB`);
          console.log(`   Wallet: ${info.wallet}`);
          
          // Check if it's linked to another transaction
          const linkedTx = await prisma.transaction.findFirst({
            where: { payoutId },
          });
          
          if (linkedTx) {
            console.log(`   ⚠️  Already linked to transaction: ${linkedTx.id}`);
            console.log(`   Order: ${linkedTx.orderId || "NONE"}`);
          } else {
            console.log(`   ✅ Available to link!`);
          }
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());