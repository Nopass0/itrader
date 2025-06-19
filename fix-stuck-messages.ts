#!/usr/bin/env node
import { db } from "./src/db";
import { createLogger } from "./src/logger";

const logger = createLogger("FixStuckMessages");

async function fixStuckMessages() {
  console.log("🔧 Fixing stuck messages");
  console.log("======================\n");

  try {
    // Get the stuck messages
    const stuckMessages = await db.prisma.chatMessage.findMany({
      where: {
        id: { in: ['cmc3p4gdw03mkik2wcgzazp8z', 'cmc3o916x47gvik8v4sf8ddgt'] }
      },
      include: {
        transaction: true
      }
    });

    console.log(`Found ${stuckMessages.length} stuck messages\n`);

    for (const msg of stuckMessages) {
      console.log(`Message ID: ${msg.id}`);
      console.log(`Transaction: ${msg.transactionId}`);
      console.log(`Transaction Status: ${msg.transaction.status}`);
      console.log(`Sender: ${msg.sender}`);
      console.log(`Content: ${msg.content}`);
      console.log(`Is Processed: ${msg.isProcessed}`);
      
      // Mark the message as processed to stop it from blocking the queue
      if (!msg.isProcessed) {
        await db.prisma.chatMessage.update({
          where: { id: msg.id },
          data: { isProcessed: true }
        });
        
        console.log(`✅ Marked message as processed\n`);
        
        // Log this action
        logger.info("Manually marked stuck message as processed", {
          messageId: msg.id,
          transactionId: msg.transactionId,
          reason: "Message was stuck due to MailSlurp configuration error"
        });
      } else {
        console.log(`⚠️  Message already marked as processed\n`);
      }
    }

    // Check for the active transaction that needs payment details
    const activeTransaction = await db.prisma.transaction.findUnique({
      where: { id: 'cmc3ovhoxgnxa65aikqi' },
      include: {
        payout: true,
        advertisement: true
      }
    });

    if (activeTransaction && activeTransaction.status === 'chat_started' && activeTransaction.chatStep === 1) {
      console.log("\n📋 Active transaction needs payment details:");
      console.log(`Transaction ID: ${activeTransaction.id}`);
      console.log(`Status: ${activeTransaction.status}`);
      console.log(`Chat Step: ${activeTransaction.chatStep}`);
      
      // Update the transaction to mark it as waiting for manual intervention
      await db.prisma.transaction.update({
        where: { id: activeTransaction.id },
        data: {
          status: 'waiting_payment',
          chatStep: 2,
          failureReason: 'MailSlurp not configured - payment details need to be sent manually'
        }
      });
      
      console.log("✅ Updated transaction status to waiting_payment");
      console.log("⚠️  Payment details need to be sent manually!");
      
      logger.warn("Transaction requires manual payment details", {
        transactionId: activeTransaction.id,
        reason: "MailSlurp email service not configured"
      });
    }

    console.log("\n✅ Done!");
    console.log("\n💡 Next steps:");
    console.log("1. Configure MailSlurp properly by ensuring emails are created");
    console.log("2. Or use Gmail for sending payment details");
    console.log("3. Send payment details manually for the active transaction");

  } catch (error) {
    console.error("Error:", error);
    logger.error("Failed to fix stuck messages", error as Error);
  } finally {
    await db.disconnect();
  }
}

fixStuckMessages().catch(console.error);