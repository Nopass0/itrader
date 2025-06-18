import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkPayoutsDetailed() {
  try {
    console.log('Checking payouts in database...\n');

    const payouts = await prisma.payout.findMany({
      include: {
        transaction: true,
        gateAccountRef: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Total payouts: ${payouts.length}\n`);

    for (const payout of payouts) {
      console.log('='.repeat(60));
      console.log(`Payout ID: ${payout.id}`);
      console.log(`Gate Payout ID: ${payout.gatePayoutId}`);
      console.log(`Status: ${payout.status}`);
      console.log(`Amount: ${payout.amount}`);
      console.log(`Wallet: ${payout.wallet}`);
      console.log(`Gate Account: ${payout.gateAccount}`);
      console.log(`Transaction ID: ${payout.transactionId || 'None'}`);
      console.log(`Created: ${payout.createdAt}`);
      
      if (payout.amountTrader) {
        console.log(`Amount Trader: ${JSON.stringify(payout.amountTrader)}`);
      }
      if (payout.totalTrader) {
        console.log(`Total Trader: ${JSON.stringify(payout.totalTrader)}`);
      }
      if (payout.meta) {
        console.log(`Meta: ${JSON.stringify(payout.meta)}`);
      }
      if (payout.transaction) {
        console.log(`\nLinked Transaction:`);
        console.log(`  - Order ID: ${payout.transaction.orderId}`);
        console.log(`  - Status: ${payout.transaction.status}`);
        console.log(`  - Amount: ${payout.transaction.amount}`);
      }
      console.log();
    }

    // Check if there are any transactions that should be linked to payouts
    const unlinkedTransactions = await prisma.transaction.findMany({
      where: {
        payoutId: null
      }
    });

    if (unlinkedTransactions.length > 0) {
      console.log(`\nFound ${unlinkedTransactions.length} transactions without linked payouts`);
    }

  } catch (error) {
    console.error('Error checking payouts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPayoutsDetailed();