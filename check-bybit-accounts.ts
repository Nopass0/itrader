import { db } from "./src/db";

async function checkBybitAccounts() {
  try {
    console.log("Checking Bybit accounts...");
    
    const accounts = await db.prisma.bybitAccount.findMany({
      where: { isActive: true }
    });
    
    console.log(`Found ${accounts.length} active Bybit accounts:`);
    for (const account of accounts) {
      console.log({
        accountId: account.accountId,
        isActive: account.isActive,
        createdAt: account.createdAt
      });
    }
    
    // Check all accounts (including inactive)
    const allAccounts = await db.prisma.bybitAccount.findMany();
    console.log(`\nTotal Bybit accounts in DB: ${allAccounts.length}`);
    
    // Check if ckks exists
    const ckks = await db.prisma.bybitAccount.findUnique({
      where: { accountId: "ckks" }
    });
    
    if (ckks) {
      console.log("\nFound ckks account:", {
        accountId: ckks.accountId,
        isActive: ckks.isActive,
        apiKey: ckks.apiKey ? "***" : "NOT SET",
        apiSecret: ckks.apiSecret ? "***" : "NOT SET"
      });
    } else {
      console.log("\nckks account NOT FOUND in database!");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.prisma.$disconnect();
  }
}

checkBybitAccounts();