#!/usr/bin/env bun

/**
 * Test direct order checking
 */

import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { db } from "../src/db";

async function main() {
  console.log("🔍 Testing direct order checking...\n");

  try {
    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`📋 Processing account: ${account.accountId}`);
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Use the getOrders method
        console.log("\nGetting orders using getOrders method...");
        const orders = await client.getOrders(1, 50);
        
        console.log(`Total orders: ${orders.totalCount}`);
        console.log(`Orders retrieved: ${orders.list.length}`);
        
        if (orders.list.length > 0) {
          // Find active orders
          const activeOrders = orders.list.filter(order => 
            order.status === 10 || order.status === 20
          );
          
          console.log(`\nActive orders found: ${activeOrders.length}`);
          
          for (const order of activeOrders) {
            console.log(`\n📦 Order ${order.id}:`);
            console.log(`  Status: ${order.status}`);
            console.log(`  Amount: ${order.amount} ${order.currencyId}`);
            console.log(`  Side: ${order.side} (${order.side === 0 ? 'Buy' : 'Sell'})`);
            
            // Get order details to find itemId
            console.log(`  Getting order details...`);
            try {
              const orderDetails = await bybitManager.getOrderDetails(order.id, account.accountId);
              console.log(`  ✅ Item ID: ${orderDetails.itemId}`);
              
              // Check if we have an advertisement for this itemId
              const advertisement = await db.prisma.advertisement.findUnique({
                where: { bybitAdId: orderDetails.itemId },
                include: { transaction: true }
              });
              
              if (advertisement) {
                console.log(`  ✅ Found advertisement: ${advertisement.id}`);
                if (advertisement.transaction) {
                  console.log(`  📄 Transaction: ${advertisement.transaction.id}`);
                  console.log(`  📎 Order ID in transaction: ${advertisement.transaction.orderId || 'NOT SET'}`);
                  
                  if (!advertisement.transaction.orderId) {
                    console.log(`  ⚠️  Need to link order to transaction!`);
                    
                    // Link the order
                    await db.prisma.transaction.update({
                      where: { id: advertisement.transaction.id },
                      data: {
                        orderId: order.id,
                        status: "chat_started"
                      }
                    });
                    
                    console.log(`  ✅ Order linked successfully!`);
                  }
                } else {
                  console.log(`  ❌ Advertisement has no transaction`);
                }
              } else {
                console.log(`  ❌ No advertisement found for itemId ${orderDetails.itemId}`);
              }
              
            } catch (error) {
              console.log(`  ❌ Error getting order details:`, error);
            }
          }
        }

      } catch (error) {
        console.error(`\n❌ Error processing account ${account.accountId}:`, error);
      }
    }

    await db.disconnect();
    console.log("\n✅ Test completed!");

  } catch (error) {
    console.error("❌ Error:", error);
    await db.disconnect();
  } finally {
    process.exit(0);
  }
}

main().catch(console.error);