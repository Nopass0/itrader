/**
 * Script to check active advertisements in the database and verify them against Bybit
 */

import { db } from "./src/db";
import { BybitP2PManagerService } from "./src/services/bybitP2PManager";
import { createLogger } from "./src/logger";
import { P2PManager } from "./src/bybit";

const logger = createLogger("CheckActiveAds", "Script");

interface AdStatus {
  dbAd: {
    id: string;
    bybitAdId: string | null;
    bybitAccountId: string;
    isActive: boolean;
    status: string | null;
    createdAt: Date;
    updatedAt: Date;
    type: string | null;
    currency: string | null;
    fiat: string | null;
    price: string | null;
    minAmount: number | null;
    maxAmount: number | null;
  };
  existsOnBybit: boolean;
  bybitStatus?: string;
  bybitDetails?: any;
}

interface AccountSummary {
  accountId: string;
  accountEmail: string | null;
  dbActiveAds: number;
  bybitActiveAds: number;
  methodCountCorrect: boolean;
  ads: AdStatus[];
}

async function checkActiveAds() {
  logger.info("Starting active advertisements check...");

  try {
    // Initialize Bybit P2P Manager Service
    const bybitService = new BybitP2PManagerService();
    await bybitService.initialize();
    
    // Give it a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get all advertisements from database
    const allAds = await db.client.advertisement.findMany({
      include: {
        bybitAccount: true,
        payout: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const activeAds = allAds.filter(ad => ad.isActive);
    const inactiveAds = allAds.filter(ad => !ad.isActive);

    logger.info(`Found ${allAds.length} total advertisements in database`);
    logger.info(`  - Active: ${activeAds.length}`);
    logger.info(`  - Inactive: ${inactiveAds.length}`);

    // Group ads by Bybit account
    const adsByAccount = new Map<string, typeof activeAds>();
    for (const ad of activeAds) {
      const accountAds = adsByAccount.get(ad.bybitAccountId) || [];
      accountAds.push(ad);
      adsByAccount.set(ad.bybitAccountId, accountAds);
    }

    // Check each account
    const accountSummaries: AccountSummary[] = [];

    for (const [accountId, ads] of adsByAccount) {
      logger.info(`\n=== Checking account: ${accountId} ===`);
      
      const account = ads[0].bybitAccount;
      const accountSummary: AccountSummary = {
        accountId,
        accountEmail: account.email,
        dbActiveAds: ads.length,
        bybitActiveAds: 0,
        methodCountCorrect: false,
        ads: [],
      };

      try {
        // Get ads from Bybit using the service method
        const bybitAdCount = await bybitService.getActiveAdCountFromBybit(accountId);
        accountSummary.bybitActiveAds = bybitAdCount;

        // Get detailed list from Bybit
        const manager = new P2PManager();
        await manager.addAccount(accountId, {
          apiKey: account.apiKey,
          apiSecret: account.apiSecret,
          testnet: false,
          debugMode: false,
          recvWindow: 50000,
        });

        const myAdsResponse = await manager.getMyAdvertisements(accountId);
        const bybitAds = myAdsResponse?.list || [];

        logger.info(`Account ${accountId} - DB ads: ${ads.length}, Bybit ads: ${bybitAds.length}, Active Bybit ads: ${bybitAdCount}`);

        // Check each DB ad against Bybit
        for (const dbAd of ads) {
          const adStatus: AdStatus = {
            dbAd: {
              id: dbAd.id,
              bybitAdId: dbAd.bybitAdId,
              bybitAccountId: dbAd.bybitAccountId,
              isActive: dbAd.isActive,
              status: dbAd.status,
              createdAt: dbAd.createdAt,
              updatedAt: dbAd.updatedAt,
              type: dbAd.type,
              currency: dbAd.currency,
              fiat: dbAd.fiat,
              price: dbAd.price,
              minAmount: dbAd.minAmount,
              maxAmount: dbAd.maxAmount,
            },
            existsOnBybit: false,
          };

          if (dbAd.bybitAdId) {
            const bybitAd = bybitAds.find((ad: any) => ad.id === dbAd.bybitAdId);
            if (bybitAd) {
              adStatus.existsOnBybit = true;
              adStatus.bybitStatus = bybitAd.status;
              adStatus.bybitDetails = {
                id: bybitAd.id,
                status: bybitAd.status,
                type: bybitAd.type,
                asset: bybitAd.asset,
                fiatCurrency: bybitAd.fiatCurrency,
                price: bybitAd.price,
                quantity: bybitAd.quantity,
                minOrderAmount: bybitAd.minOrderAmount,
                maxOrderAmount: bybitAd.maxOrderAmount,
                paymentMethod: bybitAd.paymentMethod,
                createdTime: bybitAd.createdTime,
                lastUpdateTime: bybitAd.lastUpdateTime,
              };

              logger.info(`Ad ${dbAd.id} (Bybit ID: ${dbAd.bybitAdId}) exists on Bybit with status: ${bybitAd.status}`);
            } else {
              logger.warn(`Ad ${dbAd.id} (Bybit ID: ${dbAd.bybitAdId}) NOT FOUND on Bybit!`);
            }
          } else {
            logger.warn(`Ad ${dbAd.id} has no Bybit ID!`);
          }

          accountSummary.ads.push(adStatus);
        }

        // Check if the method count is correct
        accountSummary.methodCountCorrect = accountSummary.dbActiveAds === accountSummary.bybitActiveAds;

        // Also check for Bybit ads not in our database
        for (const bybitAd of bybitAds) {
          if (bybitAd.status === "ONLINE" || bybitAd.status === 10) {
            const existsInDb = ads.some(dbAd => dbAd.bybitAdId === bybitAd.id);
            if (!existsInDb) {
              logger.warn(`Bybit ad ${bybitAd.id} is ONLINE but not in our database!`, {
                bybitAd: {
                  id: bybitAd.id,
                  type: bybitAd.type,
                  asset: bybitAd.asset,
                  fiatCurrency: bybitAd.fiatCurrency,
                  price: bybitAd.price,
                  status: bybitAd.status,
                },
              });
            }
          }
        }

        accountSummaries.push(accountSummary);
      } catch (error) {
        logger.error(`Failed to check account ${accountId}`, error as Error);
        accountSummary.ads = ads.map(ad => ({
          dbAd: {
            id: ad.id,
            bybitAdId: ad.bybitAdId,
            bybitAccountId: ad.bybitAccountId,
            isActive: ad.isActive,
            status: ad.status,
            createdAt: ad.createdAt,
            updatedAt: ad.updatedAt,
            type: ad.type,
            currency: ad.currency,
            fiat: ad.fiat,
            price: ad.price,
            minAmount: ad.minAmount,
            maxAmount: ad.maxAmount,
          },
          existsOnBybit: false,
        }));
        accountSummaries.push(accountSummary);
      }
    }

    // Print summary
    console.log("\n\n=== SUMMARY ===");
    console.log(`Total advertisements in database: ${allAds.length}`);
    console.log(`  - Active: ${activeAds.length}`);
    console.log(`  - Inactive: ${inactiveAds.length}`);
    console.log(`Total Bybit accounts with ads: ${accountSummaries.length}`);
    
    // Show all Bybit accounts
    const allBybitAccounts = await db.client.bybitAccount.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { advertisements: true }
        }
      }
    });
    
    console.log(`\nAll active Bybit accounts: ${allBybitAccounts.length}`);
    for (const account of allBybitAccounts) {
      console.log(`  - ${account.accountId} (${account.email || "No email"}) - ${account._count.advertisements} ads in DB`);
      
      // Check Bybit for this account even if no ads in DB
      if (account._count.advertisements === 0) {
        try {
          const bybitAdCount = await bybitService.getActiveAdCountFromBybit(account.accountId);
          if (bybitAdCount > 0) {
            console.log(`    ⚠️  WARNING: ${bybitAdCount} active ads on Bybit but none in DB!`);
          }
        } catch (error) {
          console.log(`    ❌ Failed to check Bybit: ${error.message}`);
        }
      }
    }
    
    console.log("\n--- Account Details ---");

    for (const summary of accountSummaries) {
      console.log(`\nAccount: ${summary.accountId} (${summary.accountEmail || "No email"})`);
      console.log(`  DB Active Ads: ${summary.dbActiveAds}`);
      console.log(`  Bybit Active Ads: ${summary.bybitActiveAds}`);
      console.log(`  getActiveAdCountFromBybit() correct: ${summary.methodCountCorrect ? "✅ YES" : "❌ NO"}`);
      
      const existingOnBybit = summary.ads.filter(ad => ad.existsOnBybit).length;
      const missingOnBybit = summary.ads.filter(ad => !ad.existsOnBybit).length;
      
      console.log(`  Ads existing on Bybit: ${existingOnBybit}/${summary.dbActiveAds}`);
      if (missingOnBybit > 0) {
        console.log(`  ⚠️  Missing on Bybit: ${missingOnBybit}`);
        for (const ad of summary.ads.filter(ad => !ad.existsOnBybit)) {
          console.log(`    - ${ad.dbAd.id} (Bybit ID: ${ad.dbAd.bybitAdId || "NONE"})`);
        }
      }
    }

    // Check for orphaned ads (ads without valid Bybit account)
    const orphanedAds = await db.client.advertisement.findMany({
      where: {
        isActive: true,
        bybitAccount: {
          isActive: false,
        },
      },
    });

    if (orphanedAds.length > 0) {
      console.log(`\n⚠️  Found ${orphanedAds.length} orphaned active ads (Bybit account is inactive)`);
      for (const ad of orphanedAds) {
        console.log(`  - Ad ${ad.id} belongs to inactive account ${ad.bybitAccountId}`);
      }
    }

    // Show inactive ads details
    if (inactiveAds.length > 0) {
      console.log("\n--- Inactive Advertisements ---");
      for (const ad of inactiveAds) {
        console.log(`\nAd ID: ${ad.id}`);
        console.log(`  Bybit Ad ID: ${ad.bybitAdId || "None"}`);
        console.log(`  Account: ${ad.bybitAccountId}`);
        console.log(`  Status: ${ad.status || "Unknown"}`);
        console.log(`  Type: ${ad.type}`);
        console.log(`  Currency: ${ad.currency}/${ad.fiat}`);
        console.log(`  Price: ${ad.price}`);
        console.log(`  Range: ${ad.minAmount} - ${ad.maxAmount}`);
        console.log(`  Created: ${ad.createdAt.toLocaleString()}`);
        console.log(`  Updated: ${ad.updatedAt.toLocaleString()}`);
        
        // Check if this ad still exists on Bybit
        if (ad.bybitAdId) {
          try {
            const manager = new P2PManager();
            await manager.addAccount(ad.bybitAccountId, {
              apiKey: ad.bybitAccount.apiKey,
              apiSecret: ad.bybitAccount.apiSecret,
              testnet: false,
              debugMode: false,
              recvWindow: 50000,
            });
            
            const myAdsResponse = await manager.getMyAdvertisements(ad.bybitAccountId);
            const bybitAds = myAdsResponse?.list || [];
            const bybitAd = bybitAds.find((bAd: any) => bAd.id === ad.bybitAdId);
            
            if (bybitAd) {
              console.log(`  ⚠️  Still exists on Bybit with status: ${bybitAd.status}`);
            } else {
              console.log(`  ✅ No longer exists on Bybit`);
            }
          } catch (error) {
            console.log(`  ❌ Failed to check Bybit: ${error.message}`);
          }
        }
      }
    }

    // Final verification of getActiveAdCountFromBybit method
    console.log("\n--- Method Verification ---");
    const allCorrect = accountSummaries.every(s => s.methodCountCorrect);
    if (allCorrect) {
      console.log("✅ getActiveAdCountFromBybit() returns correct counts for all accounts");
    } else {
      console.log("❌ getActiveAdCountFromBybit() has discrepancies:");
      for (const summary of accountSummaries.filter(s => !s.methodCountCorrect)) {
        console.log(`  Account ${summary.accountId}: Expected ${summary.dbActiveAds}, got ${summary.bybitActiveAds}`);
      }
    }

  } catch (error) {
    logger.error("Failed to check active ads", error as Error);
    console.error("Error:", error);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

// Run the check
checkActiveAds().catch(console.error);