#!/usr/bin/env bun

import { db } from "../src/db";
import { BybitP2PManagerService } from "../src/services/bybitP2PManager";
import { TimeSync } from "../src/bybit/utils/timeSync";
import { createLogger } from "../src/logger";

const logger = createLogger("CheckActiveOrder");

async function checkActiveOrderDetails() {
  try {
    console.log("🔍 Checking Active Order Details\n");

    // Force time sync first
    await TimeSync.forceSync();

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    const accounts = await bybitManager.getActiveAccounts();
    const account = accounts[0];
    
    if (!account) {
      console.log("No active accounts found");
      return;
    }

    const client = bybitManager.getClient(account.accountId);
    const httpClient = (client as any).httpClient;

    // The active order from previous test
    const activeOrderId = "1935036461250138112";

    console.log(`📋 Getting details for active order: ${activeOrderId}\n`);

    try {
      console.log("Making request to /v5/p2p/order/info...");
      const detailsResponse = await httpClient.post("/v5/p2p/order/info", {
        orderId: activeOrderId,
      });

      console.log("Response received:", JSON.stringify(detailsResponse, null, 2));

      if (detailsResponse.result?.result) {
        const details = detailsResponse.result.result;
        
        console.log("Order Details:");
        console.log("=" .repeat(50));
        console.log(`Order ID: ${details.orderId}`);
        console.log(`Item ID (Ad ID): ${details.itemId}`);
        console.log(`Status: ${details.status}`);
        console.log(`Side: ${details.side} (${details.side === 1 ? "SELL" : "BUY"})`);
        console.log(`User ID: ${details.userId}`);
        console.log(`Target User ID: ${details.targetUserId}`);
        console.log(`Amount: ${details.amount} ${details.currencyId}`);
        console.log(`Price: ${details.price}`);
        console.log(`Quantity: ${details.quantity} ${details.tokenId}`);
        console.log(`Payment Type: ${details.paymentType}`);
        console.log(`Created: ${new Date(parseInt(details.createDate)).toLocaleString()}`);

        // Check if we have an advertisement for this itemId
        console.log("\n🔍 Checking for matching advertisement...");
        const ad = await db.prisma.advertisement.findUnique({
          where: { bybitAdId: details.itemId },
          include: { transaction: true },
        });

        if (ad) {
          console.log("✅ Advertisement found!");
          console.log(`  DB ID: ${ad.id}`);
          console.log(`  Account: ${ad.bybitAccountId}`);
          console.log(`  Status: ${ad.status}`);
          console.log(`  Payment Method: ${ad.paymentMethod}`);
          console.log(`  Transaction: ${ad.transaction?.id || 'NONE'}`);
          console.log(`  Transaction Order ID: ${ad.transaction?.orderId || 'NONE'}`);
          
          // Update transaction with order ID if not set
          if (ad.transaction && !ad.transaction.orderId) {
            console.log("\n⚠️  Transaction exists but has no orderId, updating...");
            const updated = await db.prisma.transaction.update({
              where: { id: ad.transaction.id },
              data: { 
                orderId: activeOrderId,
                status: "chat_started",
                updatedAt: new Date(),
              },
            });
            console.log("✅ Transaction updated with orderId!");
          }
        } else {
          console.log(`❌ No advertisement found for itemId: ${details.itemId}`);
          
          // Check all advertisements in DB
          console.log("\n📋 All advertisements in database:");
          const allAds = await db.prisma.advertisement.findMany({
            select: {
              id: true,
              bybitAdId: true,
              bybitAccountId: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });
          
          for (const dbAd of allAds) {
            console.log(`  - ${dbAd.id}: bybitAdId=${dbAd.bybitAdId}, account=${dbAd.bybitAccountId}, status=${dbAd.status}`);
          }
          
          // Try to create the missing advertisement and transaction
          console.log("\n🔧 Creating missing advertisement and transaction...");
          
          // First check if we have the account in DB
          const dbAccount = await db.prisma.bybitAccount.findUnique({
            where: { accountId: account.accountId },
          });
          
          if (dbAccount) {
            // Create advertisement
            const newAd = await db.prisma.advertisement.create({
              data: {
                bybitAdId: details.itemId,
                bybitAccountId: dbAccount.id,
                side: details.side === 1 ? "SELL" : "BUY",
                asset: details.tokenId || "USDT",
                fiatCurrency: details.currencyId || "RUB",
                price: details.price || "0",
                quantity: details.quantity || "0",
                minOrderAmount: details.amount || "0",
                maxOrderAmount: details.amount || "0",
                paymentMethod: "Unknown",
                status: "ONLINE",
              },
            });
            
            console.log(`✅ Created advertisement: ${newAd.id}`);
            
            // Create transaction
            const newTx = await db.prisma.transaction.create({
              data: {
                advertisementId: newAd.id,
                orderId: activeOrderId,
                status: "chat_started",
              },
            });
            
            console.log(`✅ Created transaction: ${newTx.id}`);
          }
        }

        // Check chat messages
        console.log("\n💬 Checking chat messages...");
        try {
          const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
            orderId: activeOrderId,
            size: "10",
          });

          if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
            console.log(`Found ${chatResponse.result.result.length} messages`);
            
            // Show last 3 messages
            for (const msg of chatResponse.result.result.slice(0, 3)) {
              const sender = msg.userId === details.userId ? "US" : "THEM";
              console.log(`  [${sender}] ${msg.message || '(empty)'}`);
            }
          } else {
            console.log("No messages found");
          }
        } catch (error) {
          console.error("Error fetching chat messages:", error.message);
        }
      }
    } catch (error) {
      console.error("Error getting order details:", error.message);
    }

    console.log("\n✅ Check complete!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

checkActiveOrderDetails().catch(console.error);