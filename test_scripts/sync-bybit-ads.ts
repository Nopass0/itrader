#!/usr/bin/env bun

/**
 * Sync Bybit advertisements with database
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Syncing Bybit advertisements with database...\n');

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('=' .repeat(50));
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Get ads from Bybit
        const myAds = await client.getMyAdvertisements();
        console.log(`Found ${myAds.list?.length || 0} ads on Bybit`);
        
        // Get ads from database
        const dbAds = await prisma.advertisement.findMany({
          where: {
            bybitAccountId: account.accountId,
            isActive: true,
          },
        });
        console.log(`Found ${dbAds.length} active ads in database`);
        
        // Check each Bybit ad
        if (myAds.list && myAds.list.length > 0) {
          for (const bybitAd of myAds.list) {
            console.log(`\n  📦 Bybit Ad: ${bybitAd.id}`);
            console.log(`     Status: ${bybitAd.status}`);
            console.log(`     Amount: ${bybitAd.quantity} ${bybitAd.tokenId}`);
            console.log(`     Price: ${bybitAd.price} ${bybitAd.currencyId}`);
            
            // Check if exists in DB
            const dbAd = dbAds.find(ad => ad.bybitAdId === bybitAd.id);
            
            if (!dbAd) {
              console.log(`     ⚠️ NOT IN DATABASE - Creating...`);
              
              // Create in database
              await prisma.advertisement.create({
                data: {
                  bybitAdId: bybitAd.id,
                  bybitAccountId: account.accountId,
                  side: bybitAd.side === 1 ? 'SELL' : 'BUY',
                  asset: bybitAd.tokenId || 'USDT',
                  fiatCurrency: bybitAd.currencyId || 'RUB',
                  price: bybitAd.price || '0',
                  quantity: bybitAd.quantity || '0',
                  minOrderAmount: bybitAd.minAmount || '0',
                  maxOrderAmount: bybitAd.maxAmount || '0',
                  paymentMethod: bybitAd.payments?.[0] || 'Unknown',
                  status: bybitAd.status === 2 ? 'ONLINE' : 'OFFLINE',
                  isActive: bybitAd.status === 2,
                },
              });
              
              console.log(`     ✅ Created in database`);
            } else {
              console.log(`     ✅ Already in database (ID: ${dbAd.id})`);
              
              // Update status if different
              if ((bybitAd.status === 2 && !dbAd.isActive) || (bybitAd.status !== 2 && dbAd.isActive)) {
                await prisma.advertisement.update({
                  where: { id: dbAd.id },
                  data: {
                    isActive: bybitAd.status === 2,
                    status: bybitAd.status === 2 ? 'ONLINE' : 'OFFLINE',
                  },
                });
                console.log(`     📝 Updated status`);
              }
            }
          }
        }
        
        // Check for DB ads that don't exist on Bybit
        for (const dbAd of dbAds) {
          const bybitAd = myAds.list?.find(ad => ad.id === dbAd.bybitAdId);
          
          if (!bybitAd) {
            console.log(`\n  ❌ DB Ad ${dbAd.id} (Bybit: ${dbAd.bybitAdId}) not found on Bybit`);
            console.log(`     Marking as inactive...`);
            
            await prisma.advertisement.update({
              where: { id: dbAd.id },
              data: {
                isActive: false,
                status: 'DELETED',
              },
            });
          }
        }
        
      } catch (error) {
        console.error(`Error syncing account ${account.accountId}:`, error);
      }
    }

    console.log('\n\n✅ Sync completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);