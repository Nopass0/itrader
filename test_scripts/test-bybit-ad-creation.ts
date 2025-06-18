#!/usr/bin/env bun

import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { db } from "./src/db";

async function testAdCreation() {
  console.log("Testing Bybit advertisement creation...\n");
  
  try {
    // Initialize manager
    const manager = new BybitP2PManagerService();
    await manager.initialize();
    
    // Test data
    const testPayoutId = "test-payout-" + Date.now();
    const amount = "1000"; // 1000 RUB
    const currency = "RUB";
    const paymentMethod = "SBP" as const;
    
    console.log("Test parameters:");
    console.log("- Amount:", amount, currency);
    console.log("- Payment method:", paymentMethod);
    console.log("- Payout ID:", testPayoutId);
    
    // Check active ads first
    const accounts = await db.getActiveBybitAccounts();
    for (const account of accounts) {
      const count = await manager.getActiveAdCountFromBybit(account.accountId);
      console.log(`\nAccount ${account.accountId} has ${count} active ads`);
      
      // List payment methods
      console.log("\nAvailable payment methods:");
      const methods = await manager.listPaymentMethods(account.accountId);
      methods.forEach(m => {
        console.log(`- ${m.name} (ID: ${m.id}, Type: ${m.type}, Mapped: ${m.mappedName || 'N/A'})`);
      });
    }
    
    // Try to create advertisement
    console.log("\n\nAttempting to create advertisement...");
    const result = await manager.createAdvertisementWithAutoAccount(
      testPayoutId,
      amount,
      currency,
      paymentMethod
    );
    
    console.log("\n✅ Advertisement created successfully!");
    console.log("Result:", result);
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
  } finally {
    await db.disconnect();
  }
}

testAdCreation();