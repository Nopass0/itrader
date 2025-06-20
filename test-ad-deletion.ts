import { PrismaClient } from './generated/prisma';
import { createLogger } from './src/logger';

const prisma = new PrismaClient();
const logger = createLogger('TestAdDeletion');

async function testAdDeletion() {
  try {
    console.log('\n🔍 Checking advertisement deletion flow:');
    
    // 1. Check active advertisements
    const activeAds = await prisma.advertisement.findMany({
      where: {
        isActive: true
      },
      include: {
        transaction: true
      }
    });
    
    console.log(`\n📢 Active advertisements: ${activeAds.length}`);
    
    for (const ad of activeAds) {
      console.log(`   - Ad ${ad.id}:`);
      console.log(`     Bybit ID: ${ad.bybitAdId}`);
      console.log(`     Has transaction: ${!!ad.transaction}`);
      console.log(`     Has order: ${ad.transaction?.orderId ? 'YES (' + ad.transaction.orderId + ')' : 'NO'}`);
    }
    
    // 2. Check inactive advertisements with orders
    const inactiveAdsWithOrders = await prisma.advertisement.findMany({
      where: {
        isActive: false,
        transaction: {
          orderId: {
            not: null
          }
        }
      },
      include: {
        transaction: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 10
    });
    
    console.log(`\n🗑️ Recently deleted advertisements (with orders): ${inactiveAdsWithOrders.length}`);
    
    for (const ad of inactiveAdsWithOrders) {
      console.log(`   - Ad ${ad.id}:`);
      console.log(`     Bybit ID: ${ad.bybitAdId}`);
      console.log(`     Order ID: ${ad.transaction?.orderId}`);
      console.log(`     Deleted at: ${ad.updatedAt}`);
    }
    
    // 3. Check transactions with orders but active ads (shouldn't exist)
    const transactionsWithOrdersAndActiveAds = await prisma.transaction.findMany({
      where: {
        orderId: {
          not: null
        },
        advertisement: {
          isActive: true
        }
      },
      include: {
        advertisement: true
      }
    });
    
    console.log(`\n⚠️ Transactions with orders but active ads: ${transactionsWithOrdersAndActiveAds.length}`);
    
    if (transactionsWithOrdersAndActiveAds.length > 0) {
      console.log('   These advertisements should be deleted!');
      for (const tx of transactionsWithOrdersAndActiveAds) {
        console.log(`   - Transaction ${tx.id}:`);
        console.log(`     Order ID: ${tx.orderId}`);
        console.log(`     Ad ID: ${tx.advertisement?.id}`);
        console.log(`     Bybit Ad ID: ${tx.advertisement?.bybitAdId}`);
      }
    }
    
    // Summary
    console.log('\n📊 Advertisement Deletion Flow:');
    console.log('1. Order created on Bybit → ORDER_CREATED event');
    console.log('2. PayoutAdvertisingService.linkOrderToTransaction() called');
    console.log('3. Order linked to transaction');
    console.log('4. Advertisement deleted from Bybit (cancelAdvertisement)');
    console.log('5. Advertisement marked as inactive in database');
    console.log('\n✨ Deletion happens in 3 places:');
    console.log('   - PayoutAdvertisingService.linkOrderToTransaction()');
    console.log('   - OrderLinkingService (when linking orders)');
    console.log('   - P2POrderProcessor.discoverNewOrders()');
    
  } catch (error) {
    logger.error('Error in test', error);
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdDeletion();