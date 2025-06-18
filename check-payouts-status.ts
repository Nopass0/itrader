#!/usr/bin/env bun

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  try {
    // Count all transactions with payouts
    const totalWithPayouts = await prisma.transaction.count({
      where: {
        payout: {
          isNot: null
        }
      }
    });
    console.log("Total transactions with payouts:", totalWithPayouts);

    // Count transactions with payout status 5
    const withStatus5 = await prisma.transaction.count({
      where: {
        payout: {
          status: 5
        }
      }
    });
    console.log("Transactions with payout status 5:", withStatus5);

    // Show some example payouts
    const samplePayouts = await prisma.transaction.findMany({
      where: {
        payout: {
          isNot: null
        }
      },
      include: {
        payout: true
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log("\nSample payouts:");
    samplePayouts.forEach(t => {
      if (t.payout) {
        console.log(`- Transaction ${t.id}: Payout status ${t.payout.status}, amount ${t.payout.amount} RUB`);
      }
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();