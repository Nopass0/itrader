#!/usr/bin/env bun

import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { db } from "./src/db";
import { getExchangeRateManager } from "./src/services/exchangeRateManager";

async function manageAds() {
  console.log("=== Bybit Advertisement Manager ===\n");
  
  try {
    // Initialize
    const manager = new BybitP2PManagerService();
    await manager.initialize();
    
    // Get current exchange rate
    const rateManager = getExchangeRateManager();
    const currentRate = rateManager.getRate();
    console.log(`Current exchange rate: ${currentRate} RUB/USDT\n`);
    
    // Get all accounts
    const accounts = await db.getActiveBybitAccounts();
    console.log(`Found ${accounts.length} Bybit account(s)\n`);
    
    // Check ads for each account
    for (const account of accounts) {
      console.log(`\n=== Account: ${account.accountId} ===`);
      
      try {
        // Get ads from Bybit
        const p2pManager = manager.getManager();
        const myAds = await p2pManager.getMyAdvertisements(account.accountId);
        
        console.log(`Active advertisements: ${myAds.list.length}`);
        
        if (myAds.list.length > 0) {
          console.log("\nAdvertisements:");
          for (const ad of myAds.list) {
            console.log(`\n- Ad ID: ${ad.id}`);
            console.log(`  Side: ${ad.side}`);
            console.log(`  Asset: ${ad.asset}`);
            console.log(`  Price: ${ad.price} ${ad.fiatCurrency}`);
            console.log(`  Quantity: ${ad.quantity} ${ad.asset}`);
            console.log(`  Min/Max: ${ad.minOrderAmount}-${ad.maxOrderAmount} ${ad.fiatCurrency}`);
            console.log(`  Status: ${ad.status}`);
            console.log(`  Payment methods: ${ad.paymentMethods?.map(pm => pm.type).join(', ') || 'N/A'}`);
          }
          
          // Show option to delete
          console.log("\nTo delete all ads, run: bun run manage-ads.ts --delete-all");
          console.log("To delete specific ad, run: bun run manage-ads.ts --delete <ad-id>");
        } else {
          console.log("No active advertisements");
        }
        
      } catch (error: any) {
        console.error(`Error for account ${account.accountId}:`, error.message);
      }
    }
    
    // Handle command line arguments
    const args = process.argv.slice(2);
    if (args[0] === '--delete-all') {
      console.log("\n=== Deleting all advertisements ===");
      
      for (const account of accounts) {
        try {
          const p2pManager = manager.getManager();
          const myAds = await p2pManager.getMyAdvertisements(account.accountId);
          
          for (const ad of myAds.list) {
            console.log(`Deleting ad ${ad.id}...`);
            await p2pManager.deleteAdvertisement(ad.id, account.accountId);
            console.log(`✅ Deleted`);
            
            // Also remove from database
            await db.client.bybitAdvertisement.deleteMany({
              where: { bybitAdId: ad.id }
            });
          }
        } catch (error: any) {
          console.error(`Error deleting ads for ${account.accountId}:`, error.message);
        }
      }
      
    } else if (args[0] === '--delete' && args[1]) {
      const adId = args[1];
      console.log(`\n=== Deleting advertisement ${adId} ===`);
      
      // Find which account owns this ad
      let deleted = false;
      for (const account of accounts) {
        try {
          const p2pManager = manager.getManager();
          await p2pManager.deleteAdvertisement(adId, account.accountId);
          console.log(`✅ Deleted from account ${account.accountId}`);
          
          // Also remove from database
          await db.client.bybitAdvertisement.deleteMany({
            where: { bybitAdId: adId }
          });
          
          deleted = true;
          break;
        } catch (error) {
          // Continue to next account
        }
      }
      
      if (!deleted) {
        console.log(`❌ Could not delete ad ${adId} - not found or already deleted`);
      }
    } else if (args[0] === '--set-rate' && args[1]) {
      const newRate = parseFloat(args[1]);
      if (isNaN(newRate) || newRate <= 0) {
        console.error("Invalid rate. Please provide a positive number.");
      } else {
        rateManager.setRate(newRate);
        console.log(`\n✅ Exchange rate updated to ${newRate} RUB/USDT`);
      }
    } else if (args.length > 0) {
      console.log("\nUsage:");
      console.log("  bun run manage-ads.ts              - List all advertisements");
      console.log("  bun run manage-ads.ts --delete-all - Delete all advertisements");
      console.log("  bun run manage-ads.ts --delete <id> - Delete specific advertisement");
      console.log("  bun run manage-ads.ts --set-rate <rate> - Update exchange rate");
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await db.disconnect();
  }
}

manageAds();