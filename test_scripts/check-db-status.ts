import { db } from "./src/db";

async function checkDbStatus() {
  try {
    console.log("=== Checking Database Status ===\n");

    // 1. Check Bybit accounts
    const bybitAccounts = await db.getActiveBybitAccounts();
    console.log(`Bybit Accounts: ${bybitAccounts.length}`);
    for (const account of bybitAccounts) {
      console.log(`  - ${account.accountId}`);
    }

    // 2. Check active advertisements
    const advertisements = await db.prisma.advertisement.findMany({
      where: { status: "ONLINE" },
    });
    console.log(`\nActive Advertisements: ${advertisements.length}`);
    for (const ad of advertisements) {
      console.log(`  - ${ad.id} (${ad.bybitAdId}) on ${ad.bybitAccountId}`);
    }

    // 3. Check transactions
    const transactions = await db.prisma.transaction.findMany({
      include: {
        advertisement: true,
        chatMessages: true,
      },
    });
    console.log(`\nTransactions: ${transactions.length}`);
    for (const tx of transactions) {
      console.log(`  - ${tx.id}:`);
      console.log(`    Status: ${tx.status}`);
      console.log(`    Order ID: ${tx.orderId || "None"}`);
      console.log(`    Chat Step: ${tx.chatStep}`);
      console.log(`    Messages: ${tx.chatMessages.length}`);
      
      if (tx.chatMessages.length > 0) {
        console.log("    Recent messages:");
        for (const msg of tx.chatMessages.slice(-3)) {
          console.log(`      [${msg.sender}] ${msg.content.substring(0, 50)}...`);
        }
      }
    }

    // 4. Check unprocessed messages
    const unprocessedMessages = await db.getUnprocessedChatMessages();
    console.log(`\nUnprocessed Messages: ${unprocessedMessages.length}`);
    for (const msg of unprocessedMessages) {
      console.log(`  - From ${msg.sender}: ${msg.content.substring(0, 50)}...`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.disconnect();
  }
}

checkDbStatus().catch(console.error);