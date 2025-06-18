#!/usr/bin/env bun

/**
 * Script to clear test receipts from database
 */

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function clearTestReceipts() {
  console.log("🗑️  Clearing test receipts from database...\n");

  try {
    // Show current receipts
    const receipts = await prisma.receipt.findMany({
      select: {
        id: true,
        emailId: true,
        amount: true,
        senderName: true,
        transactionDate: true,
        isProcessed: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${receipts.length} receipts in database:`);
    
    for (const receipt of receipts) {
      console.log(`\n  ${receipt.id}:`);
      console.log(`    Email ID: ${receipt.emailId}`);
      console.log(`    Amount: ${receipt.amount} RUB`);
      console.log(`    Sender: ${receipt.senderName || 'Unknown'}`);
      console.log(`    Date: ${receipt.transactionDate.toLocaleString()}`);
      console.log(`    Processed: ${receipt.isProcessed ? 'Yes' : 'No'}`);
    }

    if (receipts.length === 0) {
      console.log("\nNo receipts to clear.");
      return;
    }

    // Ask for confirmation
    console.log("\n⚠️  WARNING: This will delete ALL receipts from the database!");
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all receipts
    const result = await prisma.receipt.deleteMany();
    
    console.log(`\n✅ Deleted ${result.count} receipts from database.`);

  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearTestReceipts()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });