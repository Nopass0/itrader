#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const orderId = "1935000648602411008";
  const correctPayoutGateId = 2726262; // 2304 RUB
  
  console.log(`🔧 Fixing transaction for order ${orderId}...`);

  // Find transaction
  const transaction = await prisma.transaction.findFirst({
    where: { orderId },
  });

  if (!transaction) {
    console.log("❌ No transaction found");
    return;
  }

  // Find correct payout
  const correctPayout = await prisma.payout.findUnique({
    where: { gatePayoutId: correctPayoutGateId },
  });

  if (!correctPayout) {
    console.log("❌ Correct payout not found");
    return;
  }

  console.log(`Current payout ID: ${transaction.payoutId || "NONE"}`);
  
  // First check if this payout is already linked to another transaction
  const existingTransaction = await prisma.transaction.findFirst({
    where: { payoutId: correctPayout.id },
  });
  
  if (existingTransaction && existingTransaction.id !== transaction.id) {
    console.log(`⚠️  Payout ${correctPayoutGateId} is already linked to transaction ${existingTransaction.id}`);
    console.log(`   Order: ${existingTransaction.orderId || "none"}`);
    console.log("   Cannot link the same payout to multiple transactions!");
    return;
  }
  
  // Update transaction
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { payoutId: correctPayout.id },
  });

  console.log("✅ Transaction updated!");
  console.log(`   Transaction ${transaction.id} now linked to payout ${correctPayoutGateId}`);
  console.log(`   Amount: 2304 RUB`);
  console.log(`   Wallet: ${correctPayout.wallet}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());