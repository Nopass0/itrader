#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking all transactions and payouts...\n");

  // Get all transactions with their payouts
  const transactions = await prisma.transaction.findMany({
    include: {
      payout: true,
      advertisement: true,
    },
  });

  console.log("📊 All transactions:");
  for (const tx of transactions) {
    if (tx.payout) {
      const amount = typeof tx.payout.amountTrader === "string" 
        ? JSON.parse(tx.payout.amountTrader) 
        : tx.payout.amountTrader;
      
      console.log(`Transaction ${tx.id}:`);
      console.log(`   Order: ${tx.orderId || "none"}`);
      console.log(`   Payout: ${tx.payout.gatePayoutId} (${amount?.["643"]} RUB)`);
      console.log(`   Wallet: ${tx.payout.wallet}`);
      console.log(`   Status: ${tx.status}`);
    } else {
      console.log(`Transaction ${tx.id}:`);
      console.log(`   Order: ${tx.orderId || "none"}`);
      console.log(`   Payout: NONE`);
      console.log(`   Status: ${tx.status}`);
    }
    console.log("");
  }

  // Get all payouts
  const payouts = await prisma.payout.findMany({
    where: { status: 5 },
    include: {
      transaction: true,
    },
  });

  console.log("\n📋 All payouts (status 5):");
  for (const payout of payouts) {
    const amount = typeof payout.amountTrader === "string" 
      ? JSON.parse(payout.amountTrader) 
      : payout.amountTrader;
    
    const linked = payout.transaction ? `✅ Linked to ${payout.transaction.id}` : "❌ Not linked";
    console.log(`Payout ${payout.gatePayoutId}: ${amount?.["643"]} RUB to ${payout.wallet} - ${linked}`);
  }

  // Find the issue with order 1935000648602411008
  console.log("\n🔍 Specific issue with order 1935000648602411008:");
  const problematicTx = transactions.find(tx => tx.orderId === "1935000648602411008");
  if (problematicTx && problematicTx.payout) {
    const amount = typeof problematicTx.payout.amountTrader === "string" 
      ? JSON.parse(problematicTx.payout.amountTrader) 
      : problematicTx.payout.amountTrader;
    
    console.log(`   This order is linked to payout ${problematicTx.payout.gatePayoutId} with ${amount?.["643"]} RUB`);
    console.log(`   But it should be linked to payout 2726262 with 2304 RUB`);
    
    // Check if payout 2726262 is already linked
    const correctPayout = payouts.find(p => p.gatePayoutId === 2726262);
    if (correctPayout && correctPayout.transaction) {
      console.log(`   ⚠️  Payout 2726262 is already linked to transaction ${correctPayout.transaction.id}`);
      console.log(`   That transaction has order: ${correctPayout.transaction.orderId || "none"}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());