#!/usr/bin/env bun

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { createLogger } from "../src/logger";

const logger = createLogger("DebugOrderEndpoints");

async function debugOrderEndpoints() {
  try {
    console.log("🔍 Testing All Order Endpoints\n");

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active accounts\n`);

    for (const account of accounts) {
      console.log(`\n📋 Testing account: ${account.accountId}`);
      console.log("=" .repeat(60));

      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;

      const httpClient = (client as any).httpClient;

      // Test 1: simplifyList endpoint
      console.log("\n1️⃣ Testing /v5/p2p/order/simplifyList (all orders):");
      try {
        const response = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 50,
        });
        
        console.log("Response structure:", JSON.stringify(response.result, null, 2));
        
        if (response.result?.result) {
          const result = response.result.result;
          console.log(`  Count: ${result.count || 0}`);
          console.log(`  Items: ${result.items?.length || 0}`);
          
          if (result.items && result.items.length > 0) {
            console.log("\n  First 3 orders:");
            for (const order of result.items.slice(0, 3)) {
              console.log(`    Order ${order.id}:`);
              console.log(`      Status: ${order.status}`);
              console.log(`      Side: ${order.side}`);
              console.log(`      Amount: ${order.amount} ${order.currencyId}`);
              console.log(`      Created: ${order.createDate ? new Date(parseInt(order.createDate)).toLocaleString() : 'Unknown'}`);
            }
          }
        }
      } catch (error) {
        console.error("  Error:", error.message);
      }

      // Test 2: pending/simplifyList endpoint
      console.log("\n2️⃣ Testing /v5/p2p/order/pending/simplifyList:");
      try {
        const response = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
          page: 1,
          size: 50,
        });
        
        console.log("Response structure:", JSON.stringify(response.result, null, 2));
        
        if (response.result?.result) {
          const result = response.result.result;
          console.log(`  Count: ${result.count || 0}`);
          console.log(`  Items: ${result.items?.length || 0}`);
        }
      } catch (error) {
        console.error("  Error:", error.message);
      }

      // Test 3: getPendingOrders method
      console.log("\n3️⃣ Testing getPendingOrders method:");
      try {
        const orders = await client.getPendingOrders(1, 50);
        console.log(`  Total Count: ${orders.totalCount || 0}`);
        console.log(`  Items: ${orders.list?.length || 0}`);
        
        if (orders.list && orders.list.length > 0) {
          console.log("\n  First order details:");
          const first = orders.list[0];
          console.log(`    ID: ${first.id}`);
          console.log(`    Status: ${first.status}`);
          console.log(`    Full object:`, JSON.stringify(first, null, 2));
        }
      } catch (error) {
        console.error("  Error:", error.message);
      }

      // Test 4: getOrders method
      console.log("\n4️⃣ Testing getOrders method:");
      try {
        const orders = await client.getOrders(1, 50);
        console.log(`  Total Count: ${orders.totalCount || orders.total || 0}`);
        console.log(`  Items: ${orders.list?.length || 0}`);
        
        if (orders.list && orders.list.length > 0) {
          console.log("\n  Active orders (status 5, 10, 20):");
          const activeOrders = orders.list.filter(o => [5, 10, 20].includes(o.status));
          console.log(`  Found ${activeOrders.length} active orders`);
          
          for (const order of activeOrders.slice(0, 3)) {
            console.log(`\n    Order ${order.id}:`);
            console.log(`      Status: ${order.status}`);
            console.log(`      Side: ${order.side}`);
            
            // Get full order details
            try {
              const details = await httpClient.post("/v5/p2p/order/info", {
                orderId: order.id,
              });
              
              if (details.result?.result) {
                const detail = details.result.result;
                console.log(`      Item ID (Ad ID): ${detail.itemId}`);
                console.log(`      Price: ${detail.price}`);
                console.log(`      Amount: ${detail.amount} ${detail.currencyId}`);
                console.log(`      Payment Type: ${detail.paymentType}`);
              }
            } catch (err) {
              console.error(`      Error getting details: ${err.message}`);
            }
          }
        }
      } catch (error) {
        console.error("  Error:", error.message);
      }

      // Test 5: Check advertisements for this account
      console.log("\n5️⃣ Checking advertisements for this account:");
      const ads = await db.prisma.advertisement.findMany({
        where: {
          bybitAccountId: account.accountId,
          status: "ONLINE",
        },
      });
      
      console.log(`  Found ${ads.length} active advertisements:`);
      for (const ad of ads) {
        console.log(`    Ad ${ad.id}: bybitAdId = ${ad.bybitAdId}`);
        
        // Try to check if this ad has any orders on Bybit
        try {
          console.log(`      Checking for orders with this ad...`);
          // This is a hypothetical endpoint - you might need to adjust based on Bybit's API
        } catch (err) {
          console.error(`      Error: ${err.message}`);
        }
      }
    }

    console.log("\n\n✅ Debug complete!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

debugOrderEndpoints().catch(console.error);