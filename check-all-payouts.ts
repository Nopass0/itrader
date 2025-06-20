import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function checkAllPayouts() {
  try {
    // Check all recent payouts
    const recentPayouts = await prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        transaction: true
      }
    });
    
    console.log(`\n💰 Recent payouts (last 20):`);
    
    for (const payout of recentPayouts) {
      const amount = payout.amountTrader && typeof payout.amountTrader === 'object' 
        ? (payout.amountTrader as any)['643'] || payout.amount
        : payout.amount;
        
      console.log(`\n   Payout ${payout.gatePayoutId}:`);
      console.log(`   - Amount: ${amount} RUB`);
      console.log(`   - Status: ${payout.status}`);
      console.log(`   - Wallet: ${payout.wallet}`);
      console.log(`   - Has transaction: ${!!payout.transaction}`);
      console.log(`   - Transaction status: ${payout.transaction?.status || 'N/A'}`);
      console.log(`   - Created: ${payout.createdAt}`);
    }
    
    // Check status distribution
    const statusCounts = await prisma.payout.groupBy({
      by: ['status'],
      _count: true
    });
    
    console.log('\n📊 Payout status distribution:');
    for (const stat of statusCounts) {
      console.log(`   Status ${stat.status}: ${stat._count} payouts`);
    }
    
    // Check if ReceiptPayoutLinker is finding the right payouts
    const matchablePayouts = await prisma.payout.findMany({
      where: {
        OR: [
          { amount: { in: [2000, 4500, 4700] } },
          { 
            amountTrader: {
              path: '$.643',
              in: [2000, 4500, 4700]
            }
          }
        ]
      }
    });
    
    console.log(`\n🔍 Payouts matching receipt amounts: ${matchablePayouts.length}`);
    for (const payout of matchablePayouts) {
      const amount = payout.amountTrader && typeof payout.amountTrader === 'object' 
        ? (payout.amountTrader as any)['643'] || payout.amount
        : payout.amount;
      console.log(`   - ${payout.gatePayoutId}: ${amount} RUB, status=${payout.status}, wallet=${payout.wallet}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPayouts();