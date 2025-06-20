import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function checkAllPayouts() {
  try {
    // Get ALL payouts
    const allPayouts = await prisma.payout.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        transaction: true
      }
    });

    console.log(`
📊 Total payouts: ${allPayouts.length}
`);

    // Group by status
    const byStatus: Record<number, any[]> = {};
    for (const p of allPayouts) {
      if (!byStatus[p.status]) {
        byStatus[p.status] = [];
      }
      byStatus[p.status].push(p);
    }

    // Show stats
    console.log("📈 Payouts by status:");
    for (const [status, payouts] of Object.entries(byStatus)) {
      console.log(`  Status ${status}: ${payouts.length} payouts`);
    }

    // Show payouts with null amounts
    const nullAmountPayouts = allPayouts.filter(p => p.amount === null);
    console.log(`
⚠️ Payouts with NULL amount: ${nullAmountPayouts.length}`);
    
    for (const p of nullAmountPayouts) {
      console.log(`
  Payout ${p.id} (Gate: ${p.gatePayoutId}):`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Created: ${p.createdAt}`);
      console.log(`    Wallet: ${p.wallet}`);
      console.log(`    RecipientName: ${p.recipientName}`);
      
      // Check amountTrader field
      if (p.amountTrader) {
        console.log(`    AmountTrader: ${JSON.stringify(p.amountTrader)}`);
      }
      
      // Check trader field
      if (p.trader) {
        const trader = p.trader as any;
        console.log(`    Trader: ${JSON.stringify(trader)}`);
      }
      
      if (p.transaction) {
        console.log(`    Has transaction: ${p.transaction.id} (status: ${p.transaction.status})`);
      }
    }

    // Show payouts with amounts that match our receipts
    console.log("\n💰 Payouts with amounts 4500 or 4700:");
    const matchingPayouts = allPayouts.filter(p => p.amount === 4500 || p.amount === 4700);
    
    for (const p of matchingPayouts) {
      const trader = p.trader as any;
      console.log(`
  Payout ${p.id} (Gate: ${p.gatePayoutId}):`);
      console.log(`    Amount: ${p.amount}`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Name: ${p.recipientName}`);
      console.log(`    Wallet: ${p.wallet}`);
      if (trader?.phone) {
        console.log(`    Trader phone: ${trader.phone}`);
      }
      console.log(`    Created: ${p.createdAt}`);
      if (p.transaction) {
        console.log(`    Transaction: ${p.transaction.id} (status: ${p.transaction.status})`);
      }
    }

    // Check unlinked receipts again
    console.log("\n\n📄 Unlinked receipts:");
    const unlinkedReceipts = await prisma.receipt.findMany({
      where: {
        payoutId: null,
        isParsed: true
      }
    });

    for (const r of unlinkedReceipts) {
      console.log(`  - ${r.filename}: ${r.amount} RUB, ${r.recipientPhone}`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPayouts();
