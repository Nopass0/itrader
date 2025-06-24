#!/usr/bin/env bun

import { db } from "../src/db";
import { createLogger } from "../src/logger";
import { cuid } from "../src/utils/cuid";

const logger = createLogger("FixMissingTransaction");

async function fixMissingTransaction() {
  try {
    logger.info("🔍 Starting to fix missing transaction issue");
    console.log("\n🔍 Starting to fix missing transaction issue...\n");

    // The problematic order details from logs
    const orderId = "1937481419023179776";
    const itemId = "1937471186588389376";
    const advertisementId = "cmcafqrhc006h3njgvczx4ehm";

    // Find the advertisement
    logger.info("📋 Looking for advertisement", { advertisementId });
    const advertisement = await db.prisma.advertisement.findUnique({
      where: { id: advertisementId },
      include: {
        payout: true,
        transaction: true,
        bybitAccount: true
      }
    });

    if (!advertisement) {
      logger.error("❌ Advertisement not found", { advertisementId });
      console.log("❌ Advertisement not found!");
      return;
    }

    logger.info("✅ Found advertisement", {
      id: advertisement.id,
      bybitAdId: advertisement.bybitAdId,
      payoutId: advertisement.payoutId,
      hasTransaction: !!advertisement.transaction
    });

    console.log("\n✅ Found advertisement:");
    console.log(`  ID: ${advertisement.id}`);
    console.log(`  Bybit Ad ID: ${advertisement.bybitAdId}`);
    console.log(`  Payout ID: ${advertisement.payoutId}`);
    console.log(`  Has Transaction: ${!!advertisement.transaction}`);

    if (!advertisement.payoutId) {
      logger.error("❌ Advertisement has no payoutId!", { advertisementId });
      console.log("\n❌ Advertisement has no payoutId!");
      return;
    }

    // Check if transaction exists
    if (advertisement.transaction) {
      logger.info("📦 Transaction already exists", {
        transactionId: advertisement.transaction.id,
        orderId: advertisement.transaction.orderId
      });
      console.log("\n📦 Transaction already exists:");
      console.log(`  Transaction ID: ${advertisement.transaction.id}`);
      console.log(`  Order ID: ${advertisement.transaction.orderId}`);

      // Update order ID if missing
      if (!advertisement.transaction.orderId) {
        logger.info("🔧 Updating transaction with order ID", { orderId });
        await db.prisma.transaction.update({
          where: { id: advertisement.transaction.id },
          data: {
            orderId: orderId,
            status: "chat_started",
            updatedAt: new Date()
          }
        });
        console.log("✅ Updated transaction with order ID");
      }
    } else {
      // Create missing transaction
      logger.info("🆕 Creating missing transaction", {
        payoutId: advertisement.payoutId,
        advertisementId: advertisement.id,
        orderId
      });

      const payout = await db.prisma.payout.findUnique({
        where: { id: advertisement.payoutId }
      });

      if (!payout) {
        logger.error("❌ Payout not found", { payoutId: advertisement.payoutId });
        console.log("\n❌ Payout not found!");
        return;
      }

      const payoutData = typeof payout.amountTrader === "string" 
        ? JSON.parse(payout.amountTrader) 
        : payout.amountTrader;
      const amount = payoutData?.["643"] || 0;

      const transaction = await db.prisma.transaction.create({
        data: {
          id: cuid(),
          payoutId: advertisement.payoutId,
          advertisementId: advertisement.id,
          orderId: orderId,
          amount: amount,
          counterpartyName: "Unknown", // Will be updated when order details are fetched
          status: "chat_started",
          chatStep: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info("✅ Created transaction", {
        transactionId: transaction.id,
        orderId: transaction.orderId,
        amount: transaction.amount
      });

      console.log("\n✅ Created transaction:");
      console.log(`  Transaction ID: ${transaction.id}`);
      console.log(`  Order ID: ${transaction.orderId}`);
      console.log(`  Amount: ${transaction.amount}`);
      console.log(`  Status: ${transaction.status}`);
    }

    // Verify the fix
    const updatedTransaction = await db.prisma.transaction.findFirst({
      where: { orderId: orderId },
      include: {
        advertisement: true,
        payout: true,
        chatMessages: true
      }
    });

    if (updatedTransaction) {
      logger.info("✅ Verification successful", {
        transactionId: updatedTransaction.id,
        orderId: updatedTransaction.orderId,
        advertisementId: updatedTransaction.advertisementId,
        payoutId: updatedTransaction.payoutId,
        chatMessages: updatedTransaction.chatMessages.length
      });

      console.log("\n✅ Verification successful!");
      console.log(`  Transaction ID: ${updatedTransaction.id}`);
      console.log(`  Order ID: ${updatedTransaction.orderId}`);
      console.log(`  Advertisement ID: ${updatedTransaction.advertisementId}`);
      console.log(`  Payout ID: ${updatedTransaction.payoutId}`);
      console.log(`  Chat Messages: ${updatedTransaction.chatMessages.length}`);
      console.log("\n🎉 The transaction is now properly linked and chat automation should work!");
    } else {
      logger.error("❌ Verification failed - transaction not found");
      console.log("\n❌ Verification failed - transaction not found");
    }

  } catch (error) {
    logger.error("Error fixing missing transaction", error as Error);
    console.error("\n❌ Error:", error);
  } finally {
    await db.disconnect();
  }
}

// Run the fix
fixMissingTransaction();