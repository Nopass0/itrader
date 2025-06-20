import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function testFullFlow() {
  try {
    console.log('\n>ê Testing full receipt flow:');
    
    // Check for pending payouts and transactions
    const pendingPayouts = await prisma.payout.findMany({
      where: {
        status: 5,
        transaction: {
          status: 'waiting_payment'
        }
      },
      include: {
        transaction: true
      },
      take: 5
    });
    
    console.log(`\n=° Found ${pendingPayouts.length} payouts with waiting_payment transactions`);
    
    for (const payout of pendingPayouts) {
      const amount = payout.amountTrader && typeof payout.amountTrader === 'object'
        ? (payout.amountTrader as any)['643'] || payout.amount  
        : payout.amount;
        
      console.log(`\n- Payout ${payout.id} (Gate: ${payout.gatePayoutId}):`);
      console.log(`  Amount: ${amount} RUB`);
      console.log(`  Wallet: ${payout.wallet}`);
      console.log(`  Transaction: ${payout.transaction?.id}`);
      console.log(`  Transaction status: ${payout.transaction?.status}`);
      console.log(`  Order ID: ${payout.transaction?.orderId}`);
    }
    
    // Check for transactions in release_money status
    const releaseMoneyTxs = await prisma.transaction.findMany({
      where: {
        status: 'release_money'
      },
      include: {
        payout: true
      }
    });
    
    console.log(`\nó Transactions in release_money status: ${releaseMoneyTxs.length}`);
    
    for (const tx of releaseMoneyTxs) {
      console.log(`\n- Transaction ${tx.id}:`);
      console.log(`  Order ID: ${tx.orderId}`);
      console.log(`  Approved at: ${tx.approvedAt}`);
      
      if (tx.approvedAt) {
        const minutesSince = (Date.now() - tx.approvedAt.getTime()) / (1000 * 60);
        console.log(`  Minutes since approval: ${minutesSince.toFixed(2)}`);
        console.log(`  Ready for release: ${minutesSince >= 2 ? ' YES' : `L NO (${(2 - minutesSince).toFixed(2)} min left)`}`);
      }
    }
    
    // Check unprocessed receipts
    const unprocessedReceipts = await prisma.receipt.findMany({
      where: {
        isParsed: true,
        payoutId: null
      },
      take: 5
    });
    
    console.log(`\n=Ë Unprocessed receipts: ${unprocessedReceipts.length}`);
    for (const r of unprocessedReceipts) {
      console.log(`- ${r.id}: ${r.amount} RUB`);
    }
    
    console.log('\n=Ê System Status:');
    console.log('1. MailSlurpService - downloads receipts from email');
    console.log('2. ReceiptPayoutLinkerService - links receipts to payouts and approves');
    console.log('3. AssetReleaseService - approves in Gate and sets release_money status');
    console.log('4. MoneyReleaseService - releases assets after 2 minutes');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFullFlow();