#!/usr/bin/env bun

import { P2PClient } from "./src/bybit";
import { TimeSync } from "./src/bybit/utils/timeSync";
import { db } from "./src/db";

async function testBybitComplete() {
  console.log("=== Bybit Complete Connection Test ===\n");
  
  try {
    // Step 1: Synchronize time first
    console.log("1. Synchronizing time with Bybit server...");
    await TimeSync.forceSync(false);
    console.log(`   Server offset: ${TimeSync.getOffset()}ms`);
    console.log(`   Synchronized: ${TimeSync.isSynchronized()}`);
    
    // Step 2: Get Bybit account from database
    console.log("\n2. Getting Bybit accounts from database...");
    const accounts = await db.getActiveBybitAccounts();
    if (accounts.length === 0) {
      console.log("   ❌ No active Bybit accounts found in database");
      return;
    }
    console.log(`   Found ${accounts.length} account(s)`);
    
    // Step 3: Test each account
    for (const account of accounts) {
      console.log(`\n3. Testing account: ${account.accountId}`);
      
      // Create client with debug mode
      const client = new P2PClient({
        apiKey: account.apiKey,
        apiSecret: account.apiSecret,
        testnet: false,
        debugMode: true,
        recvWindow: 20000 // 20 seconds
      });
      
      try {
        // Test connection
        console.log("   Connecting...");
        await client.connect();
        console.log("   ✅ Connected successfully!");
        
        // Test getting account info
        console.log("\n   Getting account info...");
        const info = await client.getAccountInfo();
        console.log("   Account info received:", info ? "✅" : "❌");
        
        // Test getting payment methods
        console.log("\n   Getting payment methods...");
        const paymentMethods = await client.getPaymentMethods();
        console.log(`   Payment methods found: ${Array.isArray(paymentMethods) ? paymentMethods.length : 0}`);
        
        if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
          console.log("\n   First payment method structure:");
          console.log(JSON.stringify(paymentMethods[0], null, 2));
        }
        
        // Disconnect
        client.disconnect();
        console.log("\n   ✅ Test completed for account");
        
      } catch (error: any) {
        console.error(`\n   ❌ Error for account ${account.accountId}:`, error.message);
        if (error.response?.data) {
          console.error("   API Response:", JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  } finally {
    await db.disconnect();
    console.log("\n=== Test completed ===");
  }
}

testBybitComplete();