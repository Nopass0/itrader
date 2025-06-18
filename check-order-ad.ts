#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const orderId = "1935004145860177920";
  
  console.log(`🔍 Checking order ${orderId} and its advertisement...\n`);

  // Find transaction by order ID
  const transaction = await prisma.transaction.findFirst({
    where: { orderId },
    include: {
      advertisement: true,
      payout: true,
    },
  });

  if (!transaction) {
    console.log("❌ No transaction found for this order");
    
    // Check all transactions
    const allTransactions = await prisma.transaction.findMany({
      include: { advertisement: true },
    });
    
    console.log("\nAll transactions:");
    for (const tx of allTransactions) {
      console.log(`- Transaction ${tx.id}: Order ${tx.orderId || "none"}, Ad ${tx.advertisement?.bybitAdId || "none"}`);
    }
    return;
  }

  console.log("📊 Transaction details:");
  console.log(`   ID: ${transaction.id}`);
  console.log(`   Status: ${transaction.status}`);
  console.log(`   Advertisement ID (internal): ${transaction.advertisementId}`);
  console.log(`   Payout ID: ${transaction.payoutId || "NULL"}`);

  if (transaction.advertisement) {
    console.log("\n📢 Advertisement details:");
    console.log(`   ID (internal): ${transaction.advertisement.id}`);
    console.log(`   Bybit Ad ID: ${transaction.advertisement.bybitAdId}`);
    console.log(`   Account: ${transaction.advertisement.bybitAccountId}`);
    console.log(`   Payment Method: ${transaction.advertisement.paymentMethod}`);
    console.log(`   Amount: ${transaction.advertisement.quantity}`);
    console.log(`   Created: ${transaction.advertisement.createdAt}`);
    
    // Check if this is a real advertisement or fake
    if (transaction.advertisement.bybitAdId?.startsWith("temp_") || 
        transaction.advertisement.paymentMethod === "Unknown") {
      console.log("   ⚠️  This looks like a FAKE advertisement!");
    }
  }

  // Check all advertisements
  console.log("\n📋 All advertisements in database:");
  const allAds = await prisma.advertisement.findMany({
    orderBy: { createdAt: "desc" },
  });

  for (const ad of allAds) {
    const isLinked = ad.id === transaction?.advertisementId ? "✅ LINKED TO THIS ORDER" : "";
    console.log(`- Ad ${ad.id}: Bybit ID ${ad.bybitAdId}, Payment: ${ad.paymentMethod} ${isLinked}`);
  }

  // Check for duplicate advertisements
  console.log("\n🔍 Checking for duplicate advertisements...");
  const adsByBybitId = new Map();
  for (const ad of allAds) {
    if (!adsByBybitId.has(ad.bybitAdId)) {
      adsByBybitId.set(ad.bybitAdId, []);
    }
    adsByBybitId.get(ad.bybitAdId).push(ad);
  }

  for (const [bybitAdId, ads] of adsByBybitId) {
    if (ads.length > 1) {
      console.log(`\n⚠️  Duplicate advertisements found for Bybit ID ${bybitAdId}:`);
      for (const ad of ads) {
        console.log(`   - ${ad.id}: Created ${ad.createdAt}, Payment: ${ad.paymentMethod}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());