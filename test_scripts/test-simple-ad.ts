#!/usr/bin/env bun

import { P2PClient } from "./src/bybit";
import { db } from "./src/db";

async function testSimpleAd() {
  console.log("Testing simple ad creation...\n");
  
  try {
    const accounts = await db.getActiveBybitAccounts();
    if (!accounts.length) {
      console.log("No accounts found");
      return;
    }
    
    const account = accounts[0];
    const client = new P2PClient({
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      testnet: false,
      debugMode: true,
      recvWindow: 20000
    });
    
    await client.connect();
    
    // Try different float rates
    const testParams = [
      { floatRate: 0.01, desc: "1% above market" },
      { floatRate: 0.005, desc: "0.5% above market" },
      { floatRate: 0.02, desc: "2% above market" }
    ];
    
    for (const test of testParams) {
      console.log(`\nTrying with ${test.desc} (floatRate: ${test.floatRate})...`);
      
      try {
        const result = await client.createAdvertisement({
          side: "SELL",
          asset: "USDT",
          fiatCurrency: "RUB",
          priceType: "FLOAT",
          floatRate: test.floatRate,
          quantity: "10", // 10 USDT
          minOrderAmount: "100", // 100 RUB min
          maxOrderAmount: "1000", // 1000 RUB max
          paymentIds: ["18175385"], // Tinkoff
          remarks: "Test ad"
        });
        
        console.log("✅ Success! Ad ID:", result.id);
        
        // Delete the test ad
        await client.deleteAdvertisement(result.id);
        console.log("Deleted test ad");
        break;
        
      } catch (error: any) {
        console.log("❌ Failed:", error.message);
        if (error.details?.result) {
          console.log("Error details:", JSON.stringify(error.details.result, null, 2));
        }
      }
    }
    
    client.disconnect();
    
  } catch (error: any) {
    console.error("Test error:", error.message);
  } finally {
    await db.disconnect();
  }
}

testSimpleAd();