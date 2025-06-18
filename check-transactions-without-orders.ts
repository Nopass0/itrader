import { db } from './src/db';

async function checkTransactions() {
  console.log('Checking for transactions without orders...\n');
  
  // Find transactions without orderId
  const transactionsWithoutOrders = await db.prisma.transaction.findMany({
    where: {
      orderId: null,
      status: {
        in: ['chat_started', 'waiting_payment', 'pending']
      }
    },
    include: {
      advertisement: {
        include: {
          bybitAccount: true
        }
      },
      payout: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${transactionsWithoutOrders.length} transactions without orderId\n`);
  
  for (const transaction of transactionsWithoutOrders) {
    console.log(`Transaction ${transaction.id}:`);
    console.log(`  Status: ${transaction.status}`);
    console.log(`  Created: ${transaction.createdAt.toLocaleString()}`);
    console.log(`  Advertisement ID: ${transaction.advertisementId}`);
    
    if (transaction.advertisement) {
      console.log(`  Bybit Ad ID: ${transaction.advertisement.bybitAdId}`);
      console.log(`  Bybit Account: ${transaction.advertisement.bybitAccount.accountId}`);
      console.log(`  Price: ${transaction.advertisement.price} RUB`);
      console.log(`  Quantity: ${transaction.advertisement.quantity} USDT`);
      console.log(`  Ad Status: ${transaction.advertisement.status}`);
    }
    
    if (transaction.payout) {
      console.log(`  Payout ID: ${transaction.payout.id}`);
      console.log(`  Gate Payout ID: ${transaction.payout.gatePayoutId}`);
      console.log(`  Amount: ${transaction.payout.amountTrader['643']} RUB`);
    }
    
    console.log('');
  }
  
  // Also check for recent transactions with orderId
  const transactionsWithOrders = await db.prisma.transaction.findMany({
    where: {
      orderId: { not: null }
    },
    include: {
      advertisement: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log(`\nRecent transactions WITH orderId (${transactionsWithOrders.length}):`);
  for (const transaction of transactionsWithOrders) {
    console.log(`  ${transaction.id}: orderId=${transaction.orderId}, status=${transaction.status}, created=${transaction.createdAt.toLocaleString()}`);
  }
  
  await db.disconnect();
}

checkTransactions().catch(console.error);