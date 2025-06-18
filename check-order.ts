#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const orderId = "1935000648602411008";
  
  console.log(`🔍 Checking order ${orderId}...`);

  // Find transaction by order ID
  const transaction = await prisma.transaction.findFirst({
    where: { orderId },
    include: {
      payout: true,
      advertisement: true,
    },
  });

  if (!transaction) {
    console.log("❌ No transaction found for this order");
    return;
  }

  console.log("\n📊 Transaction details:");
  console.log(`   ID: ${transaction.id}`);
  console.log(`   Status: ${transaction.status}`);
  console.log(`   Advertisement ID: ${transaction.advertisementId}`);
  console.log(`   Payout ID: ${transaction.payoutId || "NULL"}`);

  if (transaction.payout) {
    const amount = typeof transaction.payout.amountTrader === "string" 
      ? JSON.parse(transaction.payout.amountTrader) 
      : transaction.payout.amountTrader;
    
    console.log("\n💰 Linked Payout:");
    console.log(`   Gate Payout ID: ${transaction.payout.gatePayoutId}`);
    console.log(`   Amount: ${amount?.["643"]} RUB`);
    console.log(`   Wallet: ${transaction.payout.wallet}`);
    console.log(`   Status: ${transaction.payout.status}`);
  }

  // Check all payouts with status 5
  console.log("\n📋 All available payouts (status 5):");
  const payouts = await prisma.payout.findMany({
    where: { status: 5 },
    include: {
      transaction: true,
    },
  });

  for (const payout of payouts) {
    const amount = typeof payout.amountTrader === "string" 
      ? JSON.parse(payout.amountTrader) 
      : payout.amountTrader;
    
    const linked = payout.transaction ? "✅ LINKED" : "❌ NOT LINKED";
    console.log(`   Payout ${payout.gatePayoutId}: ${amount?.["643"]} RUB to ${payout.wallet} - ${linked}`);
  }

  // Look for payout with amount 2304
  console.log("\n🎯 Looking for payout with amount 2304 RUB...");
  const targetPayout = payouts.find(p => {
    const amount = typeof p.amountTrader === "string" 
      ? JSON.parse(p.amountTrader) 
      : p.amountTrader;
    return amount?.["643"] === 2304;
  });

  if (targetPayout) {
    console.log(`   Found: Payout ${targetPayout.gatePayoutId} with 2304 RUB`);
    console.log(`   Wallet: ${targetPayout.wallet}`);
    
    if (!targetPayout.transaction && transaction.payoutId !== targetPayout.id) {
      console.log("\n🔧 This payout should be linked to the transaction!");
      console.log("   Run: bun fix-single-transaction.ts to fix");
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());