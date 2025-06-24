#!/usr/bin/env bun

import { db } from "../src/db";
import { createLogger } from "../src/logger";
import { cuid } from "../src/utils/cuid";

const logger = createLogger("FixAllMissingTransactions");

async function fixAllMissingTransactions() {
  try {
    logger.info("🔍 Starting to fix all missing transactions");
    console.log("\n🔍 Starting to fix all missing transactions...\n");

    // Find all advertisements without transactions
    const advertisementsWithoutTx = await db.prisma.advertisement.findMany({
      where: {
        transaction: null,
        isActive: true
      },
      include: {
        payout: true,
        bybitAccount: true
      }
    });

    logger.info("📋 Found advertisements without transactions", {
      count: advertisementsWithoutTx.length
    });

    console.log(`📋 Found ${advertisementsWithoutTx.length} advertisements without transactions\n`);

    if (advertisementsWithoutTx.length === 0) {
      console.log("✅ All advertisements have transactions!");
      return;
    }

    let fixed = 0;
    let failed = 0;

    for (const advertisement of advertisementsWithoutTx) {
      try {
        console.log(`\n🔧 Processing advertisement: ${advertisement.id}`);
        console.log(`  Bybit Ad ID: ${advertisement.bybitAdId}`);
        console.log(`  Payout ID: ${advertisement.payoutId}`);

        if (!advertisement.payoutId) {
          logger.warn("⚠️ Advertisement has no payoutId, skipping", {
            advertisementId: advertisement.id
          });
          console.log("  ⚠️ No payout ID, skipping...");
          failed++;
          continue;
        }

        // Check if transaction already exists for this payout
        const existingTx = await db.prisma.transaction.findUnique({
          where: { payoutId: advertisement.payoutId }
        });

        if (existingTx) {
          logger.warn("⚠️ Transaction already exists for payout", {
            payoutId: advertisement.payoutId,
            transactionId: existingTx.id,
            advertisementId: existingTx.advertisementId
          });
          console.log(`  ⚠️ Transaction already exists: ${existingTx.id}`);
          
          // Update advertisement ID if different
          if (existingTx.advertisementId !== advertisement.id) {
            await db.prisma.transaction.update({
              where: { id: existingTx.id },
              data: {
                advertisementId: advertisement.id,
                updatedAt: new Date()
              }
            });
            console.log("  ✅ Updated transaction with correct advertisement ID");
            fixed++;
          }
          continue;
        }

        // Get payout details
        const payout = await db.prisma.payout.findUnique({
          where: { id: advertisement.payoutId }
        });

        if (!payout) {
          logger.error("❌ Payout not found", { payoutId: advertisement.payoutId });
          console.log("  ❌ Payout not found!");
          failed++;
          continue;
        }

        const payoutData = typeof payout.amountTrader === "string" 
          ? JSON.parse(payout.amountTrader) 
          : payout.amountTrader;
        const amount = payoutData?.["643"] || 0;

        // Create transaction
        const transaction = await db.prisma.transaction.create({
          data: {
            id: cuid(),
            payoutId: advertisement.payoutId,
            advertisementId: advertisement.id,
            amount: amount,
            status: "pending",
            chatStep: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        logger.info("✅ Created transaction", {
          transactionId: transaction.id,
          advertisementId: advertisement.id,
          payoutId: advertisement.payoutId,
          amount: transaction.amount
        });

        console.log(`  ✅ Created transaction: ${transaction.id}`);
        console.log(`  Amount: ${transaction.amount}`);
        fixed++;

      } catch (error) {
        logger.error("Failed to process advertisement", error as Error, {
          advertisementId: advertisement.id
        });
        console.log(`  ❌ Error: ${error}`);
        failed++;
      }
    }

    console.log("\n📊 Summary:");
    console.log(`  Total advertisements without transactions: ${advertisementsWithoutTx.length}`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Failed: ${failed}`);

    // Now check for advertisements with transactions but no order IDs
    console.log("\n🔍 Checking for transactions without order IDs...\n");

    const transactionsWithoutOrders = await db.prisma.transaction.findMany({
      where: {
        orderId: null,
        status: {
          notIn: ["completed", "failed", "blacklisted"]
        }
      },
      include: {
        advertisement: true,
        payout: true
      }
    });

    console.log(`📋 Found ${transactionsWithoutOrders.length} transactions without order IDs`);

    if (transactionsWithoutOrders.length > 0) {
      console.log("\nThese transactions are waiting for orders to be created on Bybit.");
      console.log("The ActiveOrdersMonitor service will link them when orders are detected.\n");

      for (const tx of transactionsWithoutOrders) {
        console.log(`  Transaction: ${tx.id}`);
        console.log(`    Advertisement: ${tx.advertisement?.bybitAdId || 'N/A'}`);
        console.log(`    Payout: ${tx.payoutId}`);
        console.log(`    Status: ${tx.status}`);
      }
    }

  } catch (error) {
    logger.error("Error fixing missing transactions", error as Error);
    console.error("\n❌ Error:", error);
  } finally {
    await db.disconnect();
  }
}

// Run the fix
fixAllMissingTransactions();