import { db } from "./src/db";

async function checkTransactions() {
  try {
    console.log("Checking active transactions...");
    
    const transactions = await db.getActiveTransactions();
    console.log(`Found ${transactions.length} active transactions`);
    
    for (const tx of transactions) {
      console.log({
        id: tx.id,
        orderId: tx.orderId,
        status: tx.status,
        chatStep: tx.chatStep,
        advertisementId: tx.advertisementId
      });
    }
    
    // Check transactions with orders
    const withOrders = await db.prisma.transaction.findMany({
      where: {
        orderId: { not: null }
      },
      include: {
        advertisement: {
          include: {
            bybitAccount: true
          }
        }
      }
    });
    
    console.log(`\nFound ${withOrders.length} transactions with orders`);
    for (const tx of withOrders) {
      console.log({
        id: tx.id,
        orderId: tx.orderId,
        status: tx.status,
        chatStep: tx.chatStep,
        bybitAccountId: (tx.advertisement as any)?.bybitAccount?.accountId
      });
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.prisma.$disconnect();
  }
}

checkTransactions();