#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function createMatchingPayouts() {
  console.log("🧪 Creating Matching Payouts for Receipts\n");

  try {
    // Get receipts
    const receipts = await prisma.receipt.findMany({
      where: {
        isProcessed: false,
        payoutId: null
      },
      orderBy: { transactionDate: 'desc' }
    });

    console.log(`Found ${receipts.length} unprocessed receipts\n`);

    // Check for Bybit account
    const bybitAccount = await prisma.bybitAccount.findFirst({
      where: { isActive: true }
    });

    if (!bybitAccount) {
      console.error("❌ No active Bybit account found.");
      return;
    }

    // Create payout for first receipt (20367 RUB to +7 (926) 999-18-08)
    const receipt1 = receipts.find(r => r.amount === 20367);
    if (receipt1) {
      console.log("Creating payout for receipt 20367 RUB...");
      
      const ad1 = await prisma.advertisement.create({
        data: {
          bybitAccountId: bybitAccount.id,
          type: "sell",
          currency: "USDT",
          fiat: "RUB",
          price: 85,
          minAmount: 100,
          maxAmount: 100000,
          paymentMethods: ["Tinkoff", "SBP"],
          isActive: true,
          bybitAdId: `manual_${Date.now()}_1`
        }
      });

      const payout1 = await prisma.payout.create({
        data: {
          status: 5,
          amountTrader: { "643": 20367 },
          totalTrader: { "643": 20367 },
          wallet: "79269991808", // +7 (926) 999-18-08
          bank: JSON.stringify({
            id: 1,
            name: "tbank",
            code: "tbank",
            label: "Т-Банк",
            active: true
          }),
          gatePayoutId: 2810001,
          recipientName: "Гейдар А."
        }
      });

      await prisma.transaction.create({
        data: {
          payoutId: payout1.id,
          advertisementId: ad1.id,
          status: "waiting_payment",
          amount: 20367,
          counterpartyName: "Test User 1",
          chatStep: 1
        }
      });

      console.log(`✅ Created payout ${payout1.id} for 20367 RUB`);
    }

    // Create payout for second receipt (8075 RUB to card *1974)
    const receipt2 = receipts.find(r => r.amount === 8075);
    if (receipt2) {
      console.log("\nCreating payout for receipt 8075 RUB...");
      
      const ad2 = await prisma.advertisement.create({
        data: {
          bybitAccountId: bybitAccount.id,
          type: "sell",
          currency: "USDT",
          fiat: "RUB",
          price: 85,
          minAmount: 100,
          maxAmount: 100000,
          paymentMethods: ["Tinkoff"],
          isActive: true,
          bybitAdId: `manual_${Date.now()}_2`
        }
      });

      const payout2 = await prisma.payout.create({
        data: {
          status: 5,
          amountTrader: { "643": 8075 },
          totalTrader: { "643": 8075 },
          wallet: "1974", // Card ending
          recipientCard: "*1974",
          bank: JSON.stringify({
            id: 1,
            name: "tbank",
            code: "tbank",
            label: "Т-Банк",
            active: true
          }),
          gatePayoutId: 2810002,
          recipientName: "Роман К."
        }
      });

      await prisma.transaction.create({
        data: {
          payoutId: payout2.id,
          advertisementId: ad2.id,
          status: "waiting_payment",
          amount: 8075,
          counterpartyName: "Test User 2",
          chatStep: 1
        }
      });

      console.log(`✅ Created payout ${payout2.id} for 8075 RUB`);
    }

    console.log("\n💡 Now run: bun run test-receipt-transaction-matching.ts");
    console.log("   to test if receipts match with these payouts.");

  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createMatchingPayouts()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });