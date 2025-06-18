import { db } from "./src/db";

async function checkStatus() {
  try {
    console.log("=== Orchestrator Status Check ===\n");
    
    // Check transactions
    const transactions = await db.prisma.transaction.findMany({
      include: {
        chatMessages: true,
        advertisement: true
      }
    });
    
    console.log(`Active Transactions: ${transactions.length}`);
    
    // Check Bybit accounts
    const bybitAccounts = await db.getActiveBybitAccounts();
    console.log(`Active Bybit Accounts: ${bybitAccounts.length}`);
    
    // Check for any logs
    const logs = await db.prisma.automationLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\nRecent Automation Logs: ${logs.length}`);
    logs.forEach(log => {
      console.log(`- ${log.action} (${log.status}): ${log.details}`);
    });
    
    // Check settings
    const mode = await db.getSetting("mode");
    console.log(`\nMode: ${mode || 'automatic'}`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.disconnect();
  }
}

checkStatus();