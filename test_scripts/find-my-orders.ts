import { db } from "./src/db";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function findMyOrders() {
  try {
    console.log("=== Finding My Orders ===\n");

    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    const accounts = await db.getActiveBybitAccounts();
    console.log(`Checking ${accounts.length} accounts...\n`);

    for (const account of accounts) {
      console.log(`Account: ${account.accountId}`);
      
      const { P2PClient } = await import("./src/bybit/p2pClient");
      const client = new P2PClient({
        apiKey: account.apiKey,
        apiSecret: account.apiSecret,
        testnet: false,
        debugMode: false,
        recvWindow: 50000,
      });

      // Try different endpoints
      console.log("\n1. Trying getOrders (no filter)...");
      try {
        const orders = await client.getOrders(1, 50);
        console.log(`   Total orders: ${orders.totalCount || orders.total || 0}`);
        
        if (orders.list && orders.list.length > 0) {
          console.log(`   Found ${orders.list.length} orders:`);
          for (const order of orders.list.slice(0, 5)) {
            console.log(`   - Order ${order.id}: Status ${order.status}, Amount ${order.amount} ${order.currencyId}`);
          }
        }
      } catch (error: any) {
        console.log(`   Error: ${error.message}`);
      }

      console.log("\n2. Trying getPendingOrders...");
      try {
        const pending = await client.getPendingOrders(1, 20);
        console.log(`   Pending orders: ${pending.totalCount || pending.total || 0}`);
        
        if (pending.list && pending.list.length > 0) {
          for (const order of pending.list) {
            console.log(`   - Order ${order.id}: ${order.amount} ${order.currencyId}`);
          }
        }
      } catch (error: any) {
        console.log(`   Error: ${error.message}`);
      }

      console.log("\n3. Trying direct API call (no status)...");
      try {
        const httpClient = (client as any).httpClient;
        const response = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 20,
        });
        
        console.log(`   Response code: ${response.ret_code}`);
        if (response.ret_code === 0 && response.result) {
          console.log(`   Count: ${response.result.count}`);
          if (response.result.items) {
            console.log(`   Items: ${response.result.items.length}`);
            
            for (const order of response.result.items.slice(0, 5)) {
              console.log(`   - Order ${order.id}: Status ${order.status} (${getStatusName(order.status)})`);
            }
          }
        }
      } catch (error: any) {
        console.log(`   Error: ${error.message}`);
      }

      console.log("\n4. Trying with each status separately...");
      const statuses = [10, 20, 30, 40, 50];
      for (const status of statuses) {
        try {
          const httpClient = (client as any).httpClient;
          const response = await httpClient.post("/v5/p2p/order/simplifyList", {
            page: 1,
            size: 10,
            status: status,
          });
          
          if (response.ret_code === 0 && response.result?.count > 0) {
            console.log(`   Status ${status} (${getStatusName(status)}): ${response.result.count} orders`);
          }
        } catch (error) {
          // Silent
        }
      }

      console.log("\n5. Getting my advertisements...");
      try {
        const ads = await client.getMyAdvertisements();
        if (ads.list && ads.list.length > 0) {
          console.log(`   Found ${ads.list.length} advertisements:`);
          for (const ad of ads.list) {
            console.log(`   - Ad ${ad.itemId}: ${ad.quantity} ${ad.tokenId} @ ${ad.price} ${ad.currencyId} (${ad.status})`);
          }
        } else {
          console.log("   No advertisements found");
        }
      } catch (error: any) {
        console.log(`   Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.disconnect();
  }
}

function getStatusName(status: number): string {
  const map: Record<number, string> = {
    10: "waiting payment",
    20: "waiting release",
    30: "completed",
    40: "cancelled",
    50: "finished",
  };
  return map[status] || "unknown";
}

findMyOrders().catch(console.error);