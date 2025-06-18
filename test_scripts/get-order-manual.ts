import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { PrismaClient } from './generated/prisma';
import { TimeSync } from './src/bybit/utils/timeSync';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Manual order search...\n');

  try {
    // Force time sync
    console.log('🕐 Syncing time...');
    await TimeSync.forceSync(false);
    console.log(`Time offset: ${TimeSync.getOffset()}ms\n`);

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    
    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('Enter order ID (or press Enter to skip): ');
      
      // For manual testing, you can hardcode an order ID here
      const orderId = ''; // PUT YOUR ORDER ID HERE
      
      if (orderId) {
        try {
          const client = bybitManager.getClient(account.accountId);
          const orderDetails = await client.getOrderDetails(orderId);
          
          console.log('\nOrder Details:');
          console.log(JSON.stringify(orderDetails, null, 2));
          
          // Get chat messages
          const messages = await client.getChatMessages(orderId, 1, 50);
          console.log(`\nChat messages: ${messages.list?.length || 0}`);
          
          if (messages.list) {
            for (const msg of messages.list) {
              console.log(`[${msg.userId}]: ${msg.message}`);
            }
          }
        } catch (error) {
          console.error('Error:', error);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);