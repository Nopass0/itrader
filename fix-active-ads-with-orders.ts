import { PrismaClient } from './generated/prisma';
import { createLogger } from './src/logger';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';

const prisma = new PrismaClient();
const logger = createLogger('FixActiveAdsWithOrders');

async function fixActiveAdsWithOrders() {
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
        advertisement: {
          include: {
            bybitAccount: true
          }
        }
      }
    });
    
    console.log(`\n🔧 Found ${transactionsToFix.length} advertisements to fix`);
    
    if (transactionsToFix.length === 0) {
      console.log('✅ No active advertisements with orders found - all good!');
      return;
    }
    
    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    for (const tx of transactionsToFix) {
      if (!tx.advertisement) continue;
      
      console.log(`\n📢 Processing advertisement ${tx.advertisement.id}`);
      console.log(`   Bybit ID: ${tx.advertisement.bybitAdId}`);
      console.log(`   Order ID: ${tx.orderId}`);
      console.log(`   Account: ${tx.advertisement.bybitAccount?.accountId}`);
      
      try {
        // Get client for the account
        const client = bybitManager.getClient(tx.advertisement.bybitAccount?.accountId || '');
        
        if (!client) {
          console.log('   ❌ No client found for account');
          continue;
        }
        
        // Try to delete advertisement from Bybit
        try {
          await client.cancelAdvertisement(tx.advertisement.bybitAdId);
          console.log('   ✅ Advertisement deleted from Bybit');
        } catch (error: any) {
          if (error.message?.includes('Item not found') || error.message?.includes('already')) {
            console.log('   ℹ️ Advertisement already deleted from Bybit');
          } else {
            console.log(`   ⚠️ Error deleting from Bybit: ${error.message}`);
          }
        }
        
        // Mark as inactive in database
        await prisma.advertisement.update({
          where: { id: tx.advertisement.id },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        });
        
        console.log('   ✅ Advertisement marked as inactive in database');
        
      } catch (error) {
        console.error(`   ❌ Error processing advertisement: ${error}`);
      }
    }
    
    console.log('\n✅ Fix completed!');
    
  } catch (error) {
    logger.error('Error in fix script', error);
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ask for confirmation
console.log('This script will:');
console.log('1. Find all active advertisements that have orders attached');
console.log('2. Delete them from Bybit');
console.log('3. Mark them as inactive in the database');
console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');

setTimeout(() => {
  fixActiveAdsWithOrders();
}, 5000);