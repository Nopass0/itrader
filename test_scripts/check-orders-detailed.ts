import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { TimeSync } from "./src/bybit/utils/timeSync";

async function checkOrdersDetailed() {
  try {
    console.log("=== Detailed Order Check ===\n");

    // Sync time first
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    const accounts = await db.getActiveBybitAccounts();
    console.log(`Found ${accounts.length} Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`\nChecking account: ${account.accountId}`);
      console.log("=" + "=".repeat(50));
      
      const client = bybitManager.getClient(account.accountId);
      if (!client) {
        console.log("❌ No client found");
        continue;
      }

      const httpClient = (client as any).httpClient;

      // 1. Try to get ALL orders without status filter
      console.log("\n1. Getting ALL orders (no status filter)...");
      try {
        const allOrdersResponse = await httpClient.post("/v5/p2p/order/simplifyList", {
          page: 1,
          size: 50,
        });

        console.log(`Response code: ${allOrdersResponse.ret_code}`);
        console.log(`Response message: ${allOrdersResponse.ret_msg}`);
        
        if (allOrdersResponse.ret_code === 0 && allOrdersResponse.result) {
          console.log(`Total count: ${allOrdersResponse.result.count}`);
          
          if (allOrdersResponse.result.items && allOrdersResponse.result.items.length > 0) {
            console.log(`\nFound ${allOrdersResponse.result.items.length} orders:`);
            
            for (const order of allOrdersResponse.result.items) {
              console.log(`\n  Order ID: ${order.id}`);
              console.log(`  Status: ${order.status} (${getStatusName(order.status)})`);
              console.log(`  Side: ${order.side} (${order.side === 1 ? "SELL" : "BUY"})`);
              console.log(`  Amount: ${order.amount} ${order.currencyId}`);
              console.log(`  Token: ${order.tokenId}`);
              console.log(`  Create date: ${new Date(parseInt(order.createDate)).toLocaleString()}`);
              console.log(`  Target: ${order.targetNickName}`);
            }
          } else {
            console.log("No orders found in response");
          }
        }
      } catch (error) {
        console.error("Error getting all orders:", error);
      }

      // 2. Try with specific statuses
      console.log("\n2. Getting orders with specific statuses...");
      const statuses = [5, 10, 20, 30, 40, 50];
      
      for (const status of statuses) {
        try {
          const statusResponse = await httpClient.post("/v5/p2p/order/simplifyList", {
            page: 1,
            size: 10,
            status: status,
          });

          if (statusResponse.ret_code === 0 && statusResponse.result?.count > 0) {
            console.log(`\n  Status ${status} (${getStatusName(status)}): ${statusResponse.result.count} orders`);
            
            if (statusResponse.result.items && statusResponse.result.items.length > 0) {
              for (const order of statusResponse.result.items.slice(0, 2)) {
                console.log(`    - Order ${order.id}: ${order.amount} ${order.currencyId}`);
              }
            }
          }
        } catch (error) {
          // Silent fail for specific status
        }
      }

      // 3. Try pending orders endpoint
      console.log("\n3. Checking pending orders endpoint...");
      try {
        const pendingResponse = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
          page: 1,
          pageSize: 20,
        });

        if (pendingResponse.ret_code === 0) {
          console.log(`Pending orders: ${pendingResponse.result?.count || 0}`);
        } else {
          console.log(`Pending orders error: ${pendingResponse.ret_msg}`);
        }
      } catch (error) {
        console.error("Error getting pending orders:", error);
      }

      // 4. Check my advertisements
      console.log("\n4. Checking my advertisements...");
      try {
        const myAdsResponse = await httpClient.post("/v5/p2p/item/list", {
          page: 1,
          pageSize: 20,
        });

        if (myAdsResponse.ret_code === 0 && myAdsResponse.result?.list) {
          console.log(`My advertisements: ${myAdsResponse.result.list.length}`);
          
          for (const ad of myAdsResponse.result.list) {
            console.log(`  - Ad ${ad.itemId}: ${ad.quantity} ${ad.tokenId} @ ${ad.price} ${ad.currencyId}`);
            console.log(`    Status: ${ad.status}`);
          }
        }
      } catch (error) {
        console.error("Error getting my ads:", error);
      }
    }

    // 5. Check database
    console.log("\n\n5. Database check:");
    console.log("=" + "=".repeat(50));
    
    const dbAds = await db.prisma.advertisement.findMany();
    console.log(`\nAdvertisements in DB: ${dbAds.length}`);
    for (const ad of dbAds) {
      console.log(`  - ${ad.id}: ${ad.bybitAdId} on ${ad.bybitAccountId} (${ad.status})`);
    }

    const dbTransactions = await db.prisma.transaction.findMany({
      include: { advertisement: true },
    });
    console.log(`\nTransactions in DB: ${dbTransactions.length}`);
    for (const tx of dbTransactions) {
      console.log(`  - ${tx.id}: Order ${tx.orderId || "None"}, Status: ${tx.status}`);
    }

    // 6. Test getAllActiveOrders method
    console.log("\n\n6. Testing getAllActiveOrders method:");
    console.log("=" + "=".repeat(50));
    
    try {
      const activeOrders = await bybitManager.getAllActiveOrders();
      console.log(`\ngetAllActiveOrders returned: ${activeOrders.length} orders`);
      
      for (const order of activeOrders) {
        console.log(`  - Order ${order.id}: Status ${order.status}, Account: ${order.bybitAccountId}`);
      }
    } catch (error) {
      console.error("Error in getAllActiveOrders:", error);
    }

  } catch (error) {
    console.error("Check failed:", error);
  } finally {
    await db.disconnect();
  }
}

function getStatusName(status: number): string {
  const statusMap: Record<number, string> = {
    5: "waiting for chain",
    10: "waiting for buyer to pay",
    20: "waiting for seller to release",
    30: "appealing",
    40: "order canceled",
    50: "order finished",
    60: "paying",
    70: "pay fail",
    80: "exception canceled",
    90: "waiting for buyer to select tokenId",
    100: "objectioning",
    110: "waiting for the user to raise an objection",
  };
  return statusMap[status] || "unknown";
}

checkOrdersDetailed().catch(console.error);