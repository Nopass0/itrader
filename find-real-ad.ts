#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Finding real advertisement for order 1935004145860177920...\n");

  // Get the transaction
  const transaction = await prisma.transaction.findFirst({
    where: { orderId: "1935004145860177920" },
    include: {
      advertisement: true,
      payout: true,
    },
  });

  if (!transaction || !transaction.payout) {
    console.log("❌ No transaction or payout found");
    return;
  }

  const payoutData = typeof transaction.payout.amountTrader === "string" 
    ? JSON.parse(transaction.payout.amountTrader) 
    : transaction.payout.amountTrader;
  const payoutAmount = payoutData?.["643"] || 0;

  console.log("📊 Transaction details:");
  console.log(`   Order: ${transaction.orderId}`);
  console.log(`   Current ad: ${transaction.advertisement?.bybitAdId}`);
  console.log(`   Payout: ${transaction.payout.gatePayoutId}`);
  console.log(`   Payout amount: ${payoutAmount} RUB`);
  console.log(`   Order amount (from ad): ${transaction.advertisement?.quantity} USDT`);

  // Calculate USDT amount from RUB
  const rate = 78.85; // approximate rate
  const expectedUsdtAmount = payoutAmount / rate;
  console.log(`   Expected USDT amount: ${expectedUsdtAmount.toFixed(2)} USDT`);

  // Find all advertisements created around the same time
  console.log("\n📋 All advertisements created recently:");
  const recentAds = await prisma.advertisement.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  for (const ad of recentAds) {
    const amountDiff = Math.abs(parseFloat(ad.quantity) - expectedUsdtAmount);
    const isClose = amountDiff < 0.5 ? "✅ CLOSE MATCH" : "";
    console.log(`- Ad ${ad.bybitAdId}: ${ad.quantity} USDT, ${ad.paymentMethod} ${isClose}`);
    if (isClose) {
      console.log(`  Created: ${ad.createdAt}`);
      console.log(`  Account: ${ad.bybitAccountId}`);
    }
  }

  // Check if the real ad ID exists
  console.log("\n🔍 Looking for advertisement with ID 1935003903941136384...");
  const realAd = await prisma.advertisement.findFirst({
    where: { bybitAdId: "1935003903941136384" },
  });

  if (realAd) {
    console.log("✅ Found real advertisement!");
    console.log(`   Amount: ${realAd.quantity} USDT`);
    console.log(`   Payment: ${realAd.paymentMethod}`);
    console.log(`   Created: ${realAd.createdAt}`);
    
    // Check amount match
    const realAdAmount = parseFloat(realAd.quantity);
    if (Math.abs(realAdAmount - expectedUsdtAmount) < 0.5) {
      console.log("\n✅ Amount matches! This is likely the correct advertisement.");
      console.log("   Run: bun link-real-ad.ts to fix the linkage");
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());