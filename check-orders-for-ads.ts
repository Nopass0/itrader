import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { db } from './src/db';

async function checkOrdersForAds() {
  console.log('Checking orders for advertisements without linked transactions...\n');
  
  const bybitManager = new BybitP2PManagerService();
  await bybitManager.initialize();
  
  // Get the ad IDs from the previous check
  const adIds = ['1935273792715083776', '1935049870839185408', '1935048072334213120'];
  
  const accounts = await db.getActiveBybitAccounts();
  
  for (const account of accounts) {
    console.log(`\nChecking account ${account.accountId}:`);
    
    try {
      const client = bybitManager.getClient(account.accountId);
      if (!client) {
        console.log('  No client available');
        continue;
      }
      
      // Get all orders
      const ordersResult = await client.getOrdersSimplified({
        page: 1,
        size: 50
      });
      
      console.log(`  Total orders: ${ordersResult.count}`);
      
      if (ordersResult.items && ordersResult.items.length > 0) {
        // Check each order for matching itemId
        for (const order of ordersResult.items) {
          if (adIds.includes(order.itemId)) {
            console.log(`\n  🎯 FOUND MATCHING ORDER!`);
            console.log(`    Order ID: ${order.id}`);
            console.log(`    Item ID: ${order.itemId}`);
            console.log(`    Status: ${order.status}`);
            console.log(`    Amount: ${order.amount} ${order.currencyId}`);
            console.log(`    Created: ${new Date(parseInt(order.createDate)).toLocaleString()}`);
            
            // Get order details
            try {
              const details = await bybitManager.getOrderDetails(order.id, account.accountId);
              console.log(`    Price: ${details.price || 'N/A'}`);
              console.log(`    Target: ${details.targetNickName || order.targetNickName}`);
            } catch (e) {
              console.log(`    Could not get order details: ${e}`);
            }
          }
        }
        
        // Also show active orders
        const activeOrders = ordersResult.items.filter((order: any) => 
          order.status === 5 || order.status === 10 || order.status === 20
        );
        
        if (activeOrders.length > 0) {
          console.log(`\n  Active orders (status 5, 10, 20): ${activeOrders.length}`);
          activeOrders.forEach((order: any) => {
            console.log(`    Order ${order.id}: itemId=${order.itemId}, status=${order.status}`);
          });
        }
      }
    } catch (error) {
      console.log(`  Error: ${error}`);
    }
  }
  
  await db.disconnect();
}

checkOrdersForAds().catch(console.error);