import { getMoneyReleaseService } from './src/services/moneyReleaseService';
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function testReleaseFlow() {
  try {
    console.log('\n= Testing MoneyReleaseService manually:');
    
    // Check current transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'release_money',
        approvedAt: { not: null }
      }
    });
    
    console.log(`\nFound ${transactions.length} transactions in release_money status`);
    
    for (const tx of transactions) {
      const minutesSince = tx.approvedAt 
        ? (Date.now() - tx.approvedAt.getTime()) / (1000 * 60)
        : 0;
        
      console.log(`\n- Transaction ${tx.id}:`);
      console.log(`  Order ID: ${tx.orderId}`);
      console.log(`  Approved at: ${tx.approvedAt}`);
      console.log(`  Minutes since: ${minutesSince.toFixed(2)}`);
      console.log(`  Ready: ${minutesSince >= 2 ? '' : 'L'}`);
    }
    
    // Start the service
    console.log('\n=æ Starting MoneyReleaseService...');
    const service = getMoneyReleaseService();
    await service.start();
    
    // Wait a bit to see if it processes
    console.log('ó Waiting 5 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop the service
    service.stop();
    console.log(' Service stopped');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReleaseFlow();