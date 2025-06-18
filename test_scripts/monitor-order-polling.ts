#!/usr/bin/env bun

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { TimeSync } from "../src/bybit/utils/timeSync";
import { createLogger } from "../src/logger";

const logger = createLogger("MonitorOrderPolling");

async function monitorOrderPolling() {
  try {
    console.log("🔍 Monitoring Order Polling\n");

    // Force time sync first
    await TimeSync.forceSync();

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    const manager = bybitManager.getManager();

    // Track processed orders
    const processedOrders = new Set<string>();

    // Listen for order updates
    manager.on('orderUpdate', async ({ accountId, order }) => {
      const orderKey = `${accountId}_${order.id}`;
      
      if (!processedOrders.has(orderKey)) {
        processedOrders.add(orderKey);
        
        console.log(`\n📋 Order Update Detected:`);
        console.log(`  Account: ${accountId}`);
        console.log(`  Order ID: ${order.id}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Amount: ${order.amount} ${order.currencyId}`);
        console.log(`  Side: ${order.side === 1 ? "SELL" : "BUY"}`);
        
        // If it's an active order (status 5, 10, or 20), check if we need to link it
        if ([5, 10, 20].includes(order.status)) {
          console.log(`  ⚠️  Active order detected!`);
          
          // Get order details to find itemId
          try {
            const orderDetails = await bybitManager.getOrderDetails(order.id, accountId);
            console.log(`  Item ID: ${orderDetails.itemId}`);
            
            // Check if we have this advertisement
            const ad = await db.prisma.advertisement.findUnique({
              where: { bybitAdId: orderDetails.itemId },
              include: { transaction: true },
            });
            
            if (ad) {
              console.log(`  ✅ Found matching advertisement!`);
              
              if (!ad.transaction?.orderId) {
                console.log(`  🔧 Linking order to transaction...`);
                
                const payoutService = bybitManager.getPayoutAdvertisingService();
                try {
                  const linkedTransaction = await payoutService.linkOrderToTransaction(
                    orderDetails.itemId,
                    order.id,
                    parseFloat(orderDetails.price)
                  );
                  console.log(`  ✅ Order linked successfully!`);
                } catch (error) {
                  console.error(`  ❌ Failed to link order: ${error.message}`);
                }
              } else {
                console.log(`  ✅ Order already linked`);
              }
            } else {
              console.log(`  ❌ No advertisement found for itemId: ${orderDetails.itemId}`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to get order details: ${error.message}`);
          }
        }
      }
    });

    // Listen for P2P events
    manager.on('p2pEvent', (event) => {
      console.log(`\n📡 P2P Event: ${event.type}`);
      console.log(`  Account: ${event.accountId}`);
      console.log(`  Data:`, event.data);
    });

    // Listen for errors
    manager.on('accountError', ({ accountId, error }) => {
      console.error(`\n❌ Account Error (${accountId}):`, error.message);
    });

    console.log("✅ Monitoring started. Watching for order updates...");
    console.log("Press Ctrl+C to stop.\n");

    // Keep the script running
    await new Promise(() => {});

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

monitorOrderPolling().catch(console.error);