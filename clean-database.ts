#!/usr/bin/env bun

/**
 * Clean database script
 * Removes all data except:
 * - WebServerAccount (website accounts)
 * - GateAccount (Gate accounts)
 * - BybitAccount (Bybit accounts)
 * - GmailAccount (Gmail accounts)
 * - AuthToken (auth tokens)
 */

import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log("🧹 Starting database cleanup...\n");

  try {
    // Start a transaction to ensure all deletions succeed or none do
    await prisma.$transaction(async (tx) => {
      // 1. Delete chat messages
      const chatMessages = await tx.chatMessage.deleteMany({});
      console.log(`✅ Deleted ${chatMessages.count} chat messages`);

      // 2. Delete transactions
      const transactions = await tx.transaction.deleteMany({});
      console.log(`✅ Deleted ${transactions.count} transactions`);

      // 3. Delete advertisements
      const advertisements = await tx.advertisement.deleteMany({});
      console.log(`✅ Deleted ${advertisements.count} advertisements`);

      // 4. Delete payouts
      const payouts = await tx.payout.deleteMany({});
      console.log(`✅ Deleted ${payouts.count} payouts`);

      // 5. Delete receipts
      const receipts = await tx.receipt.deleteMany({});
      console.log(`✅ Deleted ${receipts.count} receipts`);

      // 6. Delete tinkoff receipts
      const tinkoffReceipts = await tx.tinkoffReceipt.deleteMany({});
      console.log(`✅ Deleted ${tinkoffReceipts.count} tinkoff receipts`);

      // 7. Delete blacklisted transactions
      const blacklistedTransactions = await tx.blacklistedTransaction.deleteMany({});
      console.log(`✅ Deleted ${blacklistedTransactions.count} blacklisted transactions`);

      // 8. Delete chat templates
      const chatTemplates = await tx.chatTemplate.deleteMany({});
      console.log(`✅ Deleted ${chatTemplates.count} chat templates`);

      // 9. Delete template usage
      const templateUsage = await tx.templateUsage.deleteMany({});
      console.log(`✅ Deleted ${templateUsage.count} template usage records`);

      // 10. Delete response groups
      const responseGroups = await tx.responseGroup.deleteMany({});
      console.log(`✅ Deleted ${responseGroups.count} response groups`);

      // 11. Delete custom statuses
      const customStatuses = await tx.customStatus.deleteMany({});
      console.log(`✅ Deleted ${customStatuses.count} custom statuses`);

      // 12. Delete automation logs
      const automationLogs = await tx.automationLog.deleteMany({});
      console.log(`✅ Deleted ${automationLogs.count} automation logs`);

      // 13. Delete exchange rate history
      const exchangeRateHistory = await tx.exchangeRateHistory.deleteMany({});
      console.log(`✅ Deleted ${exchangeRateHistory.count} exchange rate history records`);

      // 14. Delete processed emails
      const processedEmails = await tx.processedEmail.deleteMany({});
      console.log(`✅ Deleted ${processedEmails.count} processed emails`);

      // 15. Delete system logs
      const systemLogs = await tx.systemLog.deleteMany({});
      console.log(`✅ Deleted ${systemLogs.count} system logs`);

      // Show what we're keeping
      console.log("\n📋 Keeping the following data:");
      
      const systemAccounts = await tx.systemAccount.count();
      console.log(`   - ${systemAccounts} System accounts (website users)`);
      
      const gateAccounts = await tx.gateAccount.count();
      console.log(`   - ${gateAccounts} Gate accounts`);
      
      const bybitAccounts = await tx.bybitAccount.count();
      console.log(`   - ${bybitAccounts} Bybit accounts`);
      
      const gmailAccounts = await tx.gmailAccount.count();
      console.log(`   - ${gmailAccounts} Gmail accounts`);
      
      const authTokens = await tx.authToken.count();
      console.log(`   - ${authTokens} Auth tokens`);
      
      const settings = await tx.settings.count();
      console.log(`   - ${settings} Settings`);
    });

    console.log("\n✅ Database cleaned successfully!");
    console.log("   All transaction data has been removed.");
    console.log("   Account configurations have been preserved.");

  } catch (error) {
    console.error("\n❌ Error cleaning database:", error);
    throw error;
  }
}

// Run the cleanup
console.log("Database Cleanup Script");
console.log("======================");
console.log("This will delete all transaction data while keeping account configurations.\n");

cleanDatabase()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\n✅ Cleanup completed!");
    process.exit(0);
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  });