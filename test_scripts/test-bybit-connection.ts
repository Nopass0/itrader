/**
 * Test Bybit P2P API connection and response formats
 */

import { P2PManager } from "./src/bybit";
import { db } from "./src/db";

async function testBybitConnection() {
  console.log("=== Testing Bybit P2P Connection ===\n");

  try {
    // Get first active Bybit account from database
    const accounts = await db.getActiveBybitAccounts();
    
    if (accounts.length === 0) {
      console.error("No active Bybit accounts found in database");
      return;
    }

    const account = accounts[0];
    console.log(`Using account: ${account.accountId}`);

    // Initialize P2P Manager
    const manager = new P2PManager();
    
    // Add account with debug mode enabled
    await manager.addAccount(account.accountId, {
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      testnet: false,
      debugMode: true, // Enable debug mode to see all requests/responses
      recvWindow: 20000,
    });

    console.log("\n1. Testing getMyAdvertisements...");
    try {
      const myAds = await manager.getMyAdvertisements(account.accountId);
      console.log("My Advertisements Response:", JSON.stringify(myAds, null, 2));
      
      if (myAds && myAds.list) {
        console.log(`Found ${myAds.list.length} advertisements`);
        myAds.list.forEach((ad, index) => {
          console.log(`  Ad ${index + 1}: ${ad.itemId} - ${ad.status} - Price: ${ad.price}`);
        });
      } else {
        console.log("No advertisements found or invalid response structure");
      }
    } catch (error) {
      console.error("Failed to get advertisements:", error);
    }

    console.log("\n2. Testing getPaymentMethods...");
    try {
      const paymentMethods = await manager.getPaymentMethods(account.accountId);
      console.log("Payment Methods Response:", JSON.stringify(paymentMethods, null, 2));
      
      if (Array.isArray(paymentMethods)) {
        console.log(`Found ${paymentMethods.length} payment methods`);
        paymentMethods.forEach((method, index) => {
          console.log(`  Method ${index + 1}: ID=${method.id}, Type=${method.paymentType}, Name=${method.paymentConfigVo?.paymentName || 'N/A'}`);
        });
      } else {
        console.log("No payment methods found or invalid response structure");
      }
    } catch (error) {
      console.error("Failed to get payment methods:", error);
    }

    console.log("\n3. Testing advertisement search...");
    try {
      const searchResult = await manager.searchAdvertisements({
        tokenId: "USDT",
        currencyId: "RUB",
        side: "1", // 1 = SELL
        page: 1,
        pageSize: 5
      }, account.accountId);
      
      console.log("Search Result:", JSON.stringify(searchResult, null, 2));
      
      if (searchResult && searchResult.list) {
        console.log(`Found ${searchResult.list.length} advertisements in search`);
      }
    } catch (error) {
      console.error("Failed to search advertisements:", error);
    }

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await db.disconnect();
  }
}

// Run the test
testBybitConnection().catch(console.error);