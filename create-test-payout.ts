#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Creating test payout with status 5...");

    // First, create a platform account if it doesn't exist
    let platformAccount = await prisma.platformAccount.findFirst({
      where: { platform: "bybit" }
    });

    if (!platformAccount) {
      platformAccount = await prisma.platformAccount.create({
        data: {
          platform: "bybit",
          email: "test@example.com",
          isActive: true,
          metadata: {}
        }
      });
    }

    // Create a transaction with a payout
    const transaction = await prisma.transaction.create({
      data: {
        accountId: platformAccount.id,
        type: "buy",
        amount: 20000,
        currency: "RUB",
        rate: 105.5,
        status: "waiting_payment",
        chatStep: "payment_sent",
        payout: {
          create: {
            amount: 20000,
            bank: "Tinkoff",
            wallet: "+79123456789", // Test phone number
            status: 5, // Pending confirmation
            metadata: {
              test: true,
              purpose: "Testing receipt matching"
            }
          }
        }
      },
      include: {
        payout: true
      }
    });

    console.log("\n✅ Created test transaction with payout:");
    console.log(`   Transaction ID: ${transaction.id}`);
    console.log(`   Payout ID: ${transaction.payout?.id}`);
    console.log(`   Amount: ${transaction.payout?.amount} RUB`);
    console.log(`   Bank: ${transaction.payout?.bank}`);
    console.log(`   Wallet: ${transaction.payout?.wallet}`);
    console.log(`   Status: ${transaction.payout?.status}`);
    console.log(`   Created at: ${transaction.createdAt}`);

    console.log("\n📌 To test matching:");
    console.log("1. Create a receipt with matching amount, bank, and phone");
    console.log("2. Run 'bun test-continuous-receipt-matcher.ts' to see matching");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();