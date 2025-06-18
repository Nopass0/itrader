#!/usr/bin/env bun

import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { db } from "./src/db";

async function testCreateAd() {
  console.log("=== Testing Bybit Advertisement Creation ===\n");
  
  try {
    // Initialize the manager
    const manager = new BybitP2PManagerService();
    await manager.initialize();
    
    // Test creating an ad with minimal parameters
    console.log("Attempting to create test advertisement...\n");
    
    // First, list available payment methods
    const accounts = await db.getActiveBybitAccounts();
    if (accounts.length === 0) {
      console.log("No active Bybit accounts found");
      return;
    }
    
    const account = accounts[0];
    const paymentMethods = await manager.listPaymentMethods(account.accountId);
    
    console.log("Available payment methods:");
    paymentMethods.forEach(pm => {
      console.log(`- ${pm.name} (ID: ${pm.id}, Type: ${pm.type})`);
    });
    
    // Try to create a small test ad
    const testAmount = "100"; // 100 RUB
    const testCurrency = "RUB";
    const testPaymentMethod = "Tinkoff";
    
    console.log(`\nTrying to create ad for ${testAmount} ${testCurrency} with ${testPaymentMethod}...\n`);
    
    try {
      const result = await manager.createAdvertisementWithAutoAccount(
        "test-payout-id",
        testAmount,
        testCurrency,
        testPaymentMethod as "SBP" | "Tinkoff"
      );
      
      console.log("✅ Advertisement created successfully!");
      console.log("Advertisement ID:", result.advertisementId);
      console.log("Account ID:", result.bybitAccountId);
      
    } catch (error: any) {
      console.error("❌ Failed to create advertisement:");
      console.error("Error message:", error.message);
      if (error.stack) {
        console.error("\nStack trace:", error.stack);
      }
    }
    
  } catch (error: any) {
    console.error("Test failed:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  } finally {
    await db.disconnect();
    console.log("\n=== Test completed ===");
  }
}

testCreateAd();