import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { PrismaClient } from './generated/prisma';
import { TimeSync } from './src/bybit/utils/timeSync';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking advertisement status...\n');

  try {
    // Sync time
    await TimeSync.forceSync(false);
    
    // Get the transaction
    const transaction = await prisma.transaction.findFirst({
      where: { status: 'pending' },
      include: { advertisement: true }
    });
    
    if (!transaction) {
      console.log('No pending transactions found');
      return;
    }
    
    console.log(`Transaction: ${transaction.id}`);
    console.log(`Advertisement Bybit ID: ${transaction.advertisement.bybitAdId}`);
    console.log(`Status in DB: ${transaction.advertisement.status}\n`);
    
    // Initialize Bybit
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accountId = transaction.advertisement.bybitAccountId;
    console.log(`Bybit Account: ${accountId}\n`);
    
    try {
      const client = bybitManager.getClient(accountId);
      
      // Get advertisement details
      console.log('Getting advertisement details from Bybit...');
      const adDetails = await client.getAdvertisementDetails(transaction.advertisement.bybitAdId);
      
      if (adDetails) {
        console.log('\nAdvertisement found on Bybit:');
        console.log(`Status: ${adDetails.status}`);
        console.log(`Price: ${adDetails.price} RUB/USDT`);
        console.log(`Amount: ${adDetails.minAmount} - ${adDetails.maxAmount} RUB`);
        console.log(`Quantity: ${adDetails.quantity} USDT`);
        console.log(`Created: ${new Date(parseInt(adDetails.createDate)).toLocaleString()}`);
      }
      
      // Get my advertisements
      console.log('\n\nGetting all my advertisements...');
      const myAds = await client.getMyAdvertisements();
      console.log(`Total ads: ${myAds.list?.length || 0}`);
      
      if (myAds.list) {
        for (const ad of myAds.list) {
          console.log(`\nAd ID: ${ad.id}`);
          console.log(`Status: ${ad.status}`);
          console.log(`Side: ${ad.side === '0' ? 'BUY' : 'SELL'}`);
          console.log(`Amount: ${ad.minAmount} - ${ad.maxAmount} ${ad.currencyId}`);
        }
      }
      
    } catch (error) {
      console.error('Error:', error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);