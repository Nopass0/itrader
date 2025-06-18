#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Fixing fake advertisements...\n");

  // Find all fake advertisements
  const fakeAds = await prisma.advertisement.findMany({
    where: {
      OR: [
        { bybitAdId: { startsWith: "temp_" } },
        { paymentMethod: "Unknown" },
      ],
    },
    include: {
      transactions: {
        include: {
          payout: true,
        },
      },
    },
  });

  console.log(`Found ${fakeAds.length} fake advertisements`);

  for (const fakeAd of fakeAds) {
    console.log(`\n📍 Fake ad: ${fakeAd.bybitAdId}`);
    console.log(`   Amount: ${fakeAd.quantity}`);
    console.log(`   Account: ${fakeAd.bybitAccountId}`);
    console.log(`   Created: ${fakeAd.createdAt}`);
    
    // Try to find real advertisement by amount and account
    const realAd = await prisma.advertisement.findFirst({
      where: {
        bybitAccountId: fakeAd.bybitAccountId,
        quantity: fakeAd.quantity,
        bybitAdId: { not: { startsWith: "temp_" } },
        paymentMethod: { not: "Unknown" },
        createdAt: {
          // Real ad should be created around the same time or before
          lte: new Date(fakeAd.createdAt.getTime() + 5 * 60 * 1000),
          gte: new Date(fakeAd.createdAt.getTime() - 30 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (realAd) {
      console.log(`   ✅ Found real ad: ${realAd.bybitAdId}`);
      console.log(`   Payment method: ${realAd.paymentMethod}`);
      
      // Update all transactions to use real advertisement
      if (fakeAd.transactions.length > 0) {
        for (const tx of fakeAd.transactions) {
          console.log(`   Updating transaction ${tx.id} to use real ad`);
          
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { advertisementId: realAd.id },
          });
        }
        
        // Delete fake advertisement
        console.log(`   Deleting fake advertisement ${fakeAd.id}`);
        await prisma.advertisement.delete({
          where: { id: fakeAd.id },
        });
      }
    } else {
      console.log(`   ❌ No real advertisement found`);
      
      // If there's a linked payout, we can determine the correct payment method
      if (fakeAd.transactions.length > 0 && fakeAd.transactions[0].payout) {
        const payout = fakeAd.transactions[0].payout;
        const bankData = typeof payout.bank === "string" ? JSON.parse(payout.bank) : payout.bank;
        
        // Determine payment method based on bank
        let paymentMethod = "Bank Transfer";
        if (bankData?.name === "tinkoff") {
          paymentMethod = "Tinkoff";
        } else if (payout.method && typeof payout.method === "object") {
          const methodData = payout.method as any;
          if (methodData.name === 2 || methodData.label?.includes("СБП")) {
            paymentMethod = "SBP";
          }
        }
        
        console.log(`   Updating payment method to: ${paymentMethod}`);
        await prisma.advertisement.update({
          where: { id: fakeAd.id },
          data: { paymentMethod },
        });
      }
    }
  }

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());