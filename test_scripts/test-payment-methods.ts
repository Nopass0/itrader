#!/usr/bin/env ts-node

/**
 * Test script to debug Bybit payment methods
 */

import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";

async function testPaymentMethods() {
  console.log("=== Testing Bybit Payment Methods ===\n");

  try {
    // Initialize database connection is automatic
    console.log("Connecting to database...");

    // Get active Bybit accounts
    const accounts = await db.getActiveBybitAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    if (accounts.length === 0) {
      console.log("No active Bybit accounts found. Please add accounts first.");
      return;
    }

    // Initialize Bybit P2P Manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    // Test payment methods for each account
    for (const account of accounts) {
      console.log(`\n=== Account: ${account.accountId} ===`);
      
      try {
        // List all payment methods
        const methods = await bybitManager.listPaymentMethods(account.accountId);
        
        console.log(`\nFound ${methods.length} payment methods:`);
        
        methods.forEach((method, index) => {
          console.log(`\n${index + 1}. Payment Method:`);
          console.log(`   ID: ${method.id}`);
          console.log(`   Name: ${method.name}`);
          console.log(`   Type: ${method.type}`);
          console.log(`   Mapped Name: ${method.mappedName || 'Not mapped'}`);
          console.log(`   Bank Name: ${method.bankName || 'N/A'}`);
          console.log(`   Account No: ${method.accountNo || 'N/A'}`);
          console.log(`   Enabled: ${method.isEnabled ? 'Yes' : 'No'}`);
        });

        // Try to create test mapping
        console.log("\n=== Testing Payment Method Mapping ===");
        
        // Clear cache to force fresh fetch
        bybitManager.clearPaymentMethodsCache(account.accountId);
        
        // This will trigger the internal getPaymentMethodsForAccount
        // Check console logs for detailed mapping process
        console.log("\nAttempting to map payment methods...");
        console.log("(Check console output above for detailed mapping process)\n");
        
      } catch (error: any) {
        console.error(`Error testing account ${account.accountId}:`, error.message);
      }
    }

  } catch (error: any) {
    console.error("Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

// Run the test
testPaymentMethods();