#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking fake payout with null gatePayoutId...\n");

  const fakePayout = await prisma.payout.findFirst({
    where: { gatePayoutId: null },
    include: { transaction: true },
  });

  if (fakePayout) {
    console.log("❌ Found fake payout!");
    console.log(`   ID: ${fakePayout.id}`);
    console.log(`   Gate Payout ID: ${fakePayout.gatePayoutId}`);
    console.log(`   Amount: ${JSON.stringify(fakePayout.amountTrader)}`);
    console.log(`   Wallet: ${fakePayout.wallet}`);
    console.log(`   Created: ${fakePayout.createdAt}`);
    console.log(`   Transaction: ${fakePayout.transaction ? "Linked" : "Not linked"}`);
    
    console.log("\n🗑️ Deleting fake payout...");
    await prisma.payout.delete({
      where: { id: fakePayout.id },
    });
    console.log("✅ Fake payout deleted!");
  } else {
    console.log("✅ No fake payouts found");
  }

  // Check all payouts
  console.log("\n📋 All remaining payouts:");
  const allPayouts = await prisma.payout.findMany({
    include: { transaction: true },
  });

  for (const payout of allPayouts) {
    const amount = typeof payout.amountTrader === "string" 
      ? JSON.parse(payout.amountTrader) 
      : payout.amountTrader;
    const linked = payout.transaction ? "✅ Linked" : "❌ Not linked";
    console.log(`- Payout ${payout.gatePayoutId}: ${amount?.["643"]} RUB - ${linked}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());