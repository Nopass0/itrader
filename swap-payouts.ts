#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Swapping payouts between transactions...\n");

  // Transaction 1: Has order but wrong/no payout
  const tx1 = await prisma.transaction.findFirst({
    where: { orderId: "1935000648602411008" },
    include: { payout: true },
  });

  // Transaction 2: Has correct payout but no order  
  const tx2 = await prisma.transaction.findFirst({
    where: { id: "cmc0oxwz00058ikn7g6dmklul" },
    include: { payout: true },
  });

  if (!tx1 || !tx2) {
    console.log("❌ Could not find both transactions");
    return;
  }

  console.log("Current state:");
  console.log(`Transaction 1 (${tx1.id}):`);
  console.log(`   Order: ${tx1.orderId}`);
  console.log(`   Payout: ${tx1.payoutId || "NONE"}`);
  
  console.log(`\nTransaction 2 (${tx2.id}):`);
  console.log(`   Order: ${tx2.orderId || "NONE"}`);
  console.log(`   Payout: ${tx2.payoutId || "NONE"}`);

  // Clear payouts first to avoid constraint issues
  await prisma.transaction.update({
    where: { id: tx1.id },
    data: { payoutId: null },
  });

  await prisma.transaction.update({
    where: { id: tx2.id },
    data: { payoutId: null },
  });

  // Now swap the payouts
  const tx1PayoutId = tx1.payoutId;
  const tx2PayoutId = tx2.payoutId;

  if (tx2PayoutId) {
    await prisma.transaction.update({
      where: { id: tx1.id },
      data: { payoutId: tx2PayoutId },
    });
  }

  if (tx1PayoutId) {
    await prisma.transaction.update({
      where: { id: tx2.id },
      data: { payoutId: tx1PayoutId },
    });
  }

  // Verify the swap
  const updatedTx1 = await prisma.transaction.findUnique({
    where: { id: tx1.id },
    include: { payout: true },
  });

  const updatedTx2 = await prisma.transaction.findUnique({
    where: { id: tx2.id },
    include: { payout: true },
  });

  console.log("\n✅ After swap:");
  if (updatedTx1?.payout) {
    const amount = typeof updatedTx1.payout.amountTrader === "string" 
      ? JSON.parse(updatedTx1.payout.amountTrader) 
      : updatedTx1.payout.amountTrader;
    console.log(`Transaction 1 (${updatedTx1.id}):`);
    console.log(`   Order: ${updatedTx1.orderId}`);
    console.log(`   Payout: ${updatedTx1.payout.gatePayoutId} (${amount?.["643"]} RUB)`);
  }

  if (updatedTx2?.payout) {
    const amount = typeof updatedTx2.payout.amountTrader === "string" 
      ? JSON.parse(updatedTx2.payout.amountTrader) 
      : updatedTx2.payout.amountTrader;
    console.log(`\nTransaction 2 (${updatedTx2.id}):`);
    console.log(`   Order: ${updatedTx2.orderId || "NONE"}`);
    console.log(`   Payout: ${updatedTx2.payout.gatePayoutId} (${amount?.["643"]} RUB)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());