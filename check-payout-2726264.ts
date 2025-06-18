#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking payout 2726264...\n");

  const payout = await prisma.payout.findFirst({
    where: { gatePayoutId: 2726264 },
    include: { transaction: true },
  });

  if (!payout) {
    console.log("❌ Payout not found");
    return;
  }

  const payoutData = typeof payout.amountTrader === "string" 
    ? JSON.parse(payout.amountTrader) 
    : payout.amountTrader;
  const amount = payoutData?.["643"] || 0;

  console.log("📊 Payout details:");
  console.log(`   Gate ID: ${payout.gatePayoutId}`);
  console.log(`   Amount: ${amount} RUB`);
  console.log(`   Wallet: ${payout.wallet}`);
  console.log(`   Status: ${payout.status}`);
  
  if (payout.transaction) {
    console.log(`\n⚠️  Already linked to transaction: ${payout.transaction.id}`);
    console.log(`   Order: ${payout.transaction.orderId || "none"}`);
    console.log(`   Status: ${payout.transaction.status}`);
    
    // Check if that transaction has an order
    if (!payout.transaction.orderId) {
      console.log("\n🔧 This transaction has no order! We can swap payouts.");
    }
  } else {
    console.log("\n✅ Not linked to any transaction");
  }

  // Check all transactions without payouts
  console.log("\n📋 Transactions without payouts:");
  const txWithoutPayouts = await prisma.transaction.findMany({
    where: { payoutId: null },
    include: { advertisement: true },
  });

  for (const tx of txWithoutPayouts) {
    console.log(`- Transaction ${tx.id}: Order ${tx.orderId || "none"}`);
    if (tx.advertisement) {
      console.log(`  Amount: ${tx.advertisement.quantity} USDT`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());