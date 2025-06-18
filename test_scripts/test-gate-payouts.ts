#!/usr/bin/env bun

import { GateClient } from "./src/gate/client";
import { RateLimiter } from "./src/gate/utils/rateLimiter";
import { loadCookiesFromFile } from "./src/gate/utils/cookieUtils";
import path from "path";

async function testGatePayouts() {
  console.log("Testing Gate.io payout functionality...\n");
  
  try {
    // Create rate limiter
    const rateLimiter = new RateLimiter({
      maxRequests: 240,
      windowMs: 60000,
    });
    
    // Create client
    const client = new GateClient(rateLimiter);
    
    // Try to load cookies
    const cookiesPath = path.join("data", "cookies", "1822.json");
    console.log(`Loading cookies from: ${cookiesPath}`);
    
    try {
      const cookies = await loadCookiesFromFile(cookiesPath);
      if (cookies.length > 0) {
        client.setCookies(cookies);
        console.log(`✓ Loaded ${cookies.length} cookies`);
      } else {
        console.log("⚠️  No cookies found");
      }
    } catch (error) {
      console.error("❌ Failed to load cookies:", error);
      return;
    }
    
    // Test authentication
    console.log("\nTesting authentication...");
    const isAuth = await client.isAuthenticated();
    console.log(`Authentication status: ${isAuth ? "✓ Authenticated" : "❌ Not authenticated"}`);
    
    if (!isAuth) {
      console.log("\n⚠️  Not authenticated. Cookies may have expired.");
      return;
    }
    
    // Get balance
    console.log("\nGetting balance...");
    try {
      const balance = await client.getBalance("RUB");
      console.log("Balance:", JSON.stringify(balance, null, 2));
    } catch (error) {
      console.error("Failed to get balance:", error);
    }
    
    // Get pending transactions
    console.log("\nGetting pending transactions...");
    try {
      const pending = await client.getPendingTransactions();
      console.log(`Found ${pending.length} pending transactions`);
      
      if (pending.length > 0) {
        console.log("\nPending transactions:");
        pending.forEach((tx, index) => {
          console.log(`\n${index + 1}. Transaction ${tx.id}:`);
          console.log(`   Status: ${tx.status}`);
          console.log(`   Amount: ${tx.amount?.trader?.["643"] || "N/A"} RUB`);
          console.log(`   Wallet: ${tx.wallet || "N/A"}`);
          console.log(`   Created: ${tx.created_at}`);
        });
      }
    } catch (error) {
      console.error("Failed to get pending transactions:", error);
    }
    
    // Get available transactions
    console.log("\nGetting available transactions...");
    try {
      const available = await client.getAvailableTransactions();
      console.log(`Found ${available.length} available transactions`);
      
      if (available.length > 0) {
        console.log("\nAvailable transactions:");
        available.forEach((tx, index) => {
          console.log(`\n${index + 1}. Transaction ${tx.id}:`);
          console.log(`   Status: ${tx.status}`);
          console.log(`   Amount: ${tx.amount?.trader?.["643"] || "N/A"} RUB`);
          console.log(`   Wallet: ${tx.wallet || "N/A"}`);
          console.log(`   Created: ${tx.created_at}`);
        });
      }
    } catch (error) {
      console.error("Failed to get available transactions:", error);
    }
    
    // Get all transactions with custom filter
    console.log("\nGetting all transactions with status 4...");
    try {
      const transactions = await client.getTransactions({
        type: "payout",
        status: 4,
        page: 1,
        per_page: 10
      });
      
      console.log(`Found ${transactions.items?.length || 0} transactions with status 4`);
      console.log("Full response:", JSON.stringify(transactions, null, 2));
    } catch (error) {
      console.error("Failed to get transactions:", error);
    }
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
}

testGatePayouts();