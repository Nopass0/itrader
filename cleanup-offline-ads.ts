import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';

const prisma = new PrismaClient();

async function cleanupOfflineAds() {
  try {
    console.log('\n🧹 Cleaning up offline advertisements...\n');
    
    // Initialize Bybit Manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    // Get all inactive ads that still have bybitAdId
    const inactiveAds = await prisma.advertisement.findMany({
      where: {
        isActive: false,
        bybitAdId: { not: null }
      },
      include: {
        bybitAccount: true
      }
    });
    
    console.log(`Found ${inactiveAds.length} inactive ads to check\n`);
    
    let deletedCount = 0;
    let offlineCount = 0;
    
    for (const ad of inactiveAds) {
      if (!ad.bybitAdId || !ad.bybitAccount) continue;
      
      try {
        console.log(`Checking ad ${ad.id} (Bybit: ${ad.bybitAdId})...`);
        
        // Try to delete the ad from Bybit
        const client = bybitManager.getClient(ad.bybitAccount.accountId);
        if (!client) {
          console.log(`  ❌ No client for account ${ad.bybitAccount.accountId}`);
          continue;
        }
        
        try {
          // First check if ad exists
          const myAds = await client.getMyAdvertisements();
          const bybitAd = myAds.list?.find((a: any) => a.id === ad.bybitAdId);
          
          if (bybitAd) {
            console.log(`  📊 Ad status on Bybit: ${bybitAd.status}`);
            
            // If it's offline (status 20), try to delete it
            if (bybitAd.status === 20 || bybitAd.status === 'OFFLINE') {
              await client.cancelAdvertisement(ad.bybitAdId);
              console.log(`  ✅ Deleted offline ad from Bybit`);
              deletedCount++;
            } else {
              console.log(`  ⚠️ Ad is still active on Bybit (status: ${bybitAd.status})`);
            }
          } else {
            console.log(`  ✅ Ad no longer exists on Bybit`);
          }
        } catch (error: any) {
          if (error.message?.includes('Ad not found')) {
            console.log(`  ✅ Ad already deleted from Bybit`);
          } else {
            console.log(`  ❌ Error: ${error.message}`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing ad ${ad.id}:`, error);
      }
    }
    
    console.log(`\n✨ Cleanup complete!`);
    console.log(`   - Deleted ${deletedCount} offline ads from Bybit`);
    console.log(`   - Total inactive ads checked: ${inactiveAds.length}`);
    
    // Now check active ad count again
    console.log(`\n📊 Checking current active ad count...`);
    const activeAccount = await prisma.bybitAccount.findFirst({
      where: { isActive: true }
    });
    
    if (activeAccount) {
      const dbCount = await prisma.advertisement.count({
        where: {
          bybitAccountId: activeAccount.id,
          isActive: true
        }
      });
      
      const bybitCount = await bybitManager.getActiveAdCountFromBybit(activeAccount.accountId);
      
      console.log(`\n📈 Account ${activeAccount.accountId}:`);
      console.log(`   - Active ads in DB: ${dbCount}`);
      console.log(`   - Active ads on Bybit: ${bybitCount}`);
      console.log(`   - Can create new ads: ${bybitCount < 2 ? '✅ YES' : '❌ NO (limit reached)'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOfflineAds();