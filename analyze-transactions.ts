#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Analyzing all transactions and their relationships...\n");

  // Get all transactions
  const transactions = await prisma.transaction.findMany({
    include: {
      payout: true,
      advertisement: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${transactions.length} transactions:\n`);

  for (const tx of transactions) {
    console.log(`📊 Transaction ${tx.id}:`);
    console.log(`   Created: ${tx.createdAt.toLocaleString()}`);
    console.log(`   Status: ${tx.status}`);
    console.log(`   Order ID: ${tx.orderId || "❌ NONE"}`);
    console.log(`   Payout ID: ${tx.payoutId || "❌ NONE"}`);
    
    if (tx.payout) {
      const amount = typeof tx.payout.amountTrader === "string" 
        ? JSON.parse(tx.payout.amountTrader) 
        : tx.payout.amountTrader;
      console.log(`   ✅ Payout: ${tx.payout.gatePayoutId} (${amount?.["643"]} RUB)`);
    }
    
    if (tx.advertisement) {
      console.log(`   Advertisement:`);
      console.log(`     - ID: ${tx.advertisement.id}`);
      console.log(`     - Bybit Ad ID: ${tx.advertisement.bybitAdId}`);
      console.log(`     - Amount: ${tx.advertisement.quantity} USDT`);
      console.log(`     - Payment: ${tx.advertisement.paymentMethod}`);
    }
    
    console.log("");
  }

  // Check for orders with fake advertisements
  console.log("🔍 Checking for problematic advertisements:\n");
  const ads = await prisma.advertisement.findMany({
    include: {
      transactions: true,
    },
  });

  for (const ad of ads) {
    if (ad.bybitAdId?.startsWith("temp_") || ad.paymentMethod === "Unknown") {
      console.log(`⚠️ Problematic advertisement: ${ad.bybitAdId}`);
      console.log(`   Payment method: ${ad.paymentMethod}`);
      console.log(`   Linked to ${ad.transactions.length} transaction(s)`);
    }
  }

  // Suggest fixes
  console.log("\n💡 Suggested fixes:\n");
  
  // Find transactions with orders but no payouts
  const txWithOrderNoPayouts = transactions.filter(tx => tx.orderId && !tx.payoutId);
  if (txWithOrderNoPayouts.length > 0) {
    console.log(`Found ${txWithOrderNoPayouts.length} transaction(s) with orders but no payouts:`);
    
    for (const tx of txWithOrderNoPayouts) {
      console.log(`\n- Transaction ${tx.id} (Order: ${tx.orderId})`);
      
      if (tx.advertisement) {
        const adAmount = parseFloat(tx.advertisement.quantity);
        const expectedRub = adAmount * 78.85; // approximate rate
        
        console.log(`  Advertisement amount: ${adAmount} USDT ≈ ${expectedRub.toFixed(0)} RUB`);
        
        // Find matching payout
        const payouts = await prisma.payout.findMany({
          where: {
            status: 5,
            transaction: null,
          },
        });
        
        for (const payout of payouts) {
          const payoutData = typeof payout.amountTrader === "string" 
            ? JSON.parse(payout.amountTrader) 
            : payout.amountTrader;
          const payoutAmount = payoutData?.["643"] || 0;
          
          if (Math.abs(payoutAmount - expectedRub) < 50) {
            console.log(`  🎯 Potential match: Payout ${payout.gatePayoutId} (${payoutAmount} RUB)`);
          }
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());