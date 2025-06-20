import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function markAdsInactive() {
  try {
    // Find transactions with orders but active ads
    const transactionsToFix = await prisma.transaction.findMany({
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
    
    console.log(`\n🔧 Found ${transactionsToFix.length} advertisements to mark as inactive`);
    
    if (transactionsToFix.length === 0) {
      console.log('✅ No active advertisements with orders found - all good!');
      return;
    }
    
    for (const tx of transactionsToFix) {
      if (!tx.advertisement) continue;
      
      console.log(`\n📢 Processing advertisement ${tx.advertisement.id}`);
      console.log(`   Bybit ID: ${tx.advertisement.bybitAdId}`);
      console.log(`   Order ID: ${tx.orderId}`);
      
      // Mark as inactive in database
      await prisma.advertisement.update({
        where: { id: tx.advertisement.id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });
      
      console.log('   ✅ Advertisement marked as inactive in database');
    }
    
    console.log('\n✅ All advertisements marked as inactive!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

markAdsInactive();