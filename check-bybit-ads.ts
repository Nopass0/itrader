import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';

const prisma = new PrismaClient();

async function checkBybitAds() {
  try {
    console.log('\n🔍 Checking all ads on Bybit...\n');
    
    // Initialize Bybit Manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    // Get active account
    const activeAccount = await prisma.bybitAccount.findFirst({
      where: { isActive: true }
    });
    
    if (!activeAccount) {
      console.log('No active account found');
      return;
    }
    
    console.log(`Checking account: ${activeAccount.accountId}\n`);
    
    // Get client
    const client = bybitManager.getClient(activeAccount.accountId);
    if (!client) {
      console.log('Failed to get client');
      return;
    }
    
    // Get all ads from Bybit
    const myAds = await client.getMyAdvertisements();
    
    console.log(`Total ads on Bybit: ${myAds.list?.length || 0}\n`);
    
    if (myAds.list && myAds.list.length > 0) {
      for (const ad of myAds.list) {
        console.log(`Ad ID: ${ad.id}`);
        console.log(`  Status: ${ad.status} (10=ONLINE, 20=OFFLINE, 30=COMPLETED)`);
        console.log(`  Side: ${ad.side}`);
        console.log(`  Asset: ${ad.asset}`);
        console.log(`  Fiat: ${ad.fiatCurrency}`);
        console.log(`  Price: ${ad.price}`);
        console.log(`  Quantity: ${ad.quantity}`);
        console.log(`  Available: ${ad.available || 'N/A'}`);
        console.log(`  Min: ${ad.minOrderAmount} - Max: ${ad.maxOrderAmount}`);
        console.log(`  Payment Methods: ${ad.paymentMethods?.join(', ') || 'N/A'}`);
        console.log(`  Created: ${new Date(parseInt(ad.createTime)).toLocaleString()}`);
        
        // Check if this ad exists in our database
        const dbAd = await prisma.advertisement.findFirst({
          where: { bybitAdId: ad.id }
        });
        
        if (dbAd) {
          console.log(`  📊 In DB: YES (ID: ${dbAd.id}, Active: ${dbAd.isActive})`);
        } else {
          console.log(`  ⚠️ In DB: NO - This ad is not tracked in our database!`);
        }
        
        // If it's an active ad, we might want to delete it
        if (ad.status === 10 || ad.status === 'ONLINE') {
          console.log(`  🚨 This is an ACTIVE ad!`);
          
          // Check if we should delete it
          if (!dbAd || !dbAd.isActive) {
            console.log(`  💡 This ad should be deleted (not active in our DB)`);
            
            // Ask for confirmation
            console.log(`\n  Deleting ad ${ad.id}...`);
            try {
              await client.cancelAdvertisement(ad.id);
              console.log(`  ✅ Ad deleted successfully!`);
            } catch (error: any) {
              console.log(`  ❌ Failed to delete: ${error.message}`);
            }
          }
        }
        
        console.log('');
      }
    } else {
      console.log('No advertisements found on Bybit');
    }
    
    // Final count
    const finalCount = await bybitManager.getActiveAdCountFromBybit(activeAccount.accountId);
    console.log(`\n📊 Final active ad count: ${finalCount}`);
    console.log(`✅ Can create new ads: ${finalCount < 2 ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBybitAds();