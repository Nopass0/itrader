#!/usr/bin/env bun

/**
 * Test order list endpoint directly
 */

import { BybitP2PManagerService } from "../src/services/bybitP2PManager";

async function main() {
  console.log("🔍 Testing order list endpoint...\n");

  try {
    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`📋 Testing account: ${account.accountId}`);
      
      try {
        const client = bybitManager.getClient(account.accountId);
        const httpClient = (client as any).httpClient;
        
        // Test different parameter combinations
        console.log("\n1️⃣ Testing with minimal params (page only):");
        try {
          const response1 = await httpClient.post("/v5/p2p/order/simplifyList", {
            page: 1
          });
          console.log("✅ Success with page only");
          console.log(`  Count: ${response1.result?.count || 0}`);
          console.log(`  Items: ${response1.result?.items?.length || 0}`);
        } catch (error: any) {
          console.log("❌ Failed with page only:", error.message);
          if (error.details?.ext_info) {
            console.log("  ext_info:", JSON.stringify(error.details.ext_info, null, 2));
          }
        }

        console.log("\n2️⃣ Testing with empty object:");
        try {
          const response2 = await httpClient.post("/v5/p2p/order/simplifyList", {});
          console.log("✅ Success with empty object");
          console.log(`  Count: ${response2.result?.count || 0}`);
          console.log(`  Items: ${response2.result?.items?.length || 0}`);
        } catch (error: any) {
          console.log("❌ Failed with empty object:", error.message);
          if (error.details?.ext_info) {
            console.log("  ext_info:", JSON.stringify(error.details.ext_info, null, 2));
          }
        }

        console.log("\n3️⃣ Testing with additional params:");
        try {
          const response3 = await httpClient.post("/v5/p2p/order/simplifyList", {
            page: 1,
            size: 20,
            side: 0 // Try adding side parameter
          });
          console.log("✅ Success with additional params");
          console.log(`  Count: ${response3.result?.count || 0}`);
          console.log(`  Items: ${response3.result?.items?.length || 0}`);
        } catch (error: any) {
          console.log("❌ Failed with additional params:", error.message);
          if (error.details?.ext_info) {
            console.log("  ext_info:", JSON.stringify(error.details.ext_info, null, 2));
          }
        }

        // Get successful orders to understand the structure
        console.log("\n4️⃣ Getting order directly (known ID):");
        try {
          const orderDetails = await httpClient.post("/v5/p2p/order/info", {
            orderId: "1935283627188994048"
          });
          console.log("✅ Got order details successfully");
          console.log(`  Order ID: ${orderDetails.result?.id}`);
          console.log(`  Item ID: ${orderDetails.result?.itemId}`);
          console.log(`  Status: ${orderDetails.result?.status}`);
          console.log(`  Side: ${orderDetails.result?.side}`);
        } catch (error: any) {
          console.log("❌ Failed to get order details:", error.message);
        }

      } catch (error) {
        console.error(`\n❌ Error testing account ${account.accountId}:`, error);
      }
    }

    console.log("\n✅ Test completed!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

main().catch(console.error);