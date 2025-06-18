#!/usr/bin/env bun

import { P2PClient } from "./src/bybit";
import { db } from "./src/db";

async function testFixedPriceAd() {
  console.log("Testing fixed price ad creation...\n");
  
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
    
    // Try with fixed price
    console.log("\nTrying with FIXED price type...");
    
    try {
      const result = await client.createAdvertisement({
        side: "SELL",
        asset: "USDT",
        fiatCurrency: "RUB",
        priceType: "FIXED",
        price: "92.5", // 92.5 RUB per USDT
        quantity: "10", // 10 USDT
        minOrderAmount: "100", // 100 RUB min
        maxOrderAmount: "925", // 925 RUB max (10 USDT * 92.5)
        paymentIds: ["18175385"], // Tinkoff
        remarks: "Fast trade, instant release"
      });
      
      console.log("✅ Success! Ad created:");
      console.log("Ad ID:", result.id);
      console.log("Price:", result.price);
      console.log("Status:", result.status);
      
      // Delete the test ad
      console.log("\nDeleting test ad...");
      await client.deleteAdvertisement(result.id);
      console.log("✅ Test ad deleted");
      
    } catch (error: any) {
      console.log("❌ Failed:", error.message);
      if (error.details) {
        console.log("Full error details:", JSON.stringify(error.details, null, 2));
      }
      
      // Try to understand what parameters are expected
      console.log("\nLet's check existing ads to understand the format...");
      try {
        const myAds = await client.getMyAdvertisements(1, 5);
        if (myAds.list.length > 0) {
          console.log("\nExample of existing ad:");
          const ad = myAds.list[0];
          console.log({
            side: ad.side,
            asset: ad.asset,
            fiatCurrency: ad.fiatCurrency,
            price: ad.price,
            quantity: ad.quantity,
            minOrderAmount: ad.minOrderAmount,
            maxOrderAmount: ad.maxOrderAmount,
            paymentMethods: ad.paymentMethods?.map(pm => ({ id: pm.id, type: pm.type }))
          });
        } else {
          console.log("No existing ads found");
        }
      } catch (e) {
        console.log("Could not fetch existing ads");
      }
    }
    
    client.disconnect();
    
  } catch (error: any) {
    console.error("Test error:", error.message);
  } finally {
    await db.disconnect();
  }
}

testFixedPriceAd();