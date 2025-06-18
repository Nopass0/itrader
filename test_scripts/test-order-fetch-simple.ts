#!/usr/bin/env bun

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { TimeSync } from "../src/bybit/utils/timeSync";
import { createLogger } from "../src/logger";

const logger = createLogger("TestOrderFetch");

async function testOrderFetch() {
  try {
    console.log("🔍 Testing Order Fetching with Time Sync\n");

    // Force time sync first
    console.log("⏰ Syncing time with Bybit server...");
    await TimeSync.forceSync();
    console.log(`✅ Time synced. Offset: ${TimeSync.getOffset()}ms\n`);

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active accounts\n`);

    for (const account of accounts) {
      console.log(`\n📋 Testing account: ${account.accountId}`);
      console.log("=" .repeat(50));

      const client = bybitManager.getClient(account.accountId);
      if (!client) continue;

      const httpClient = (client as any).httpClient;

      // Test simple order list
      console.log("\n1️⃣ Testing simplifyList endpoint:");
      try {
        console.log("  Making request...");
        const response = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 20,
        });

        console.log("  Raw response:", JSON.stringify(response, null, 2));

        if (response.result?.result) {
          const result = response.result.result;
          console.log(`  ✅ Success!`);
          console.log(`  Total count: ${result.count || 0}`);
          console.log(`  Items returned: ${result.items?.length || 0}`);

          if (result.items && result.items.length > 0) {
            console.log("\n  First order:");
            const order = result.items[0];
            console.log(`    ID: ${order.id}`);
            console.log(`    Status: ${order.status}`);
            console.log(`    Amount: ${order.amount} ${order.currencyId}`);
            
            // Get order details
            console.log("\n  Getting order details...");
            try {
              const detailsResponse = await httpClient.post("/v5/p2p/order/info", {
                orderId: order.id,
              });
              
              if (detailsResponse.result?.result) {
                const details = detailsResponse.result.result;
                console.log(`    Item ID (Ad ID): ${details.itemId}`);
                console.log(`    User ID: ${details.userId}`);
                console.log(`    Target User ID: ${details.targetUserId}`);
                
                // Check if we have this advertisement
                const ad = await db.prisma.advertisement.findUnique({
                  where: { bybitAdId: details.itemId },
                });
                
                if (ad) {
                  console.log(`    ✅ Advertisement found in DB!`);
                  console.log(`       DB ID: ${ad.id}`);
                  console.log(`       Account: ${ad.bybitAccountId}`);
                } else {
                  console.log(`    ❌ No advertisement found for itemId: ${details.itemId}`);
                }
              }
            } catch (error) {
              console.error(`    Error getting details: ${error.message}`);
            }
          }
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        if (error.message.includes("timestamp")) {
          console.log(`  ⚠️  This is a timestamp error. Current offset: ${TimeSync.getOffset()}ms`);
        }
      }

      // Test pending orders
      console.log("\n2️⃣ Testing pending orders:");
      try {
        const response = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
          page: 1,
          size: 20,
        });

        if (response.result?.result) {
          const result = response.result.result;
          console.log(`  ✅ Success!`);
          console.log(`  Total count: ${result.count || 0}`);
          console.log(`  Items returned: ${result.items?.length || 0}`);
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
      }

      // Test with status filter
      console.log("\n3️⃣ Testing with status filter (status=10):");
      try {
        const response = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 20,
          status: 10,
        });

        if (response.result?.result) {
          const result = response.result.result;
          console.log(`  ✅ Success!`);
          console.log(`  Total count: ${result.count || 0}`);
          console.log(`  Items returned: ${result.items?.length || 0}`);
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
      }
    }

    console.log("\n\n✅ Test complete!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

testOrderFetch().catch(console.error);