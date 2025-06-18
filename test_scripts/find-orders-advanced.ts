#!/usr/bin/env bun

/**
 * Advanced order search using different API methods
 */

import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { HttpClient } from './src/bybit/utils/httpClient';

async function main() {
  console.log('🔍 Advanced order search...\n');

  try {
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('=' .repeat(60));
      
      try {
        const client = bybitManager.getClient(account.accountId) as any;
        const httpClient = client.httpClient as HttpClient;
        
        // Try different API endpoints
        console.log('\n1️⃣ Trying /v5/p2p/order/pending/simplifyList with different parameters...');
        
        // Try without status filter
        try {
          const pendingResponse = await httpClient.post('/v5/p2p/order/pending/simplifyList', {
            page: 1,
            size: 50
          });
          console.log('   Response:', JSON.stringify(pendingResponse.result, null, 2));
        } catch (error: any) {
          console.error('   Error:', error.message);
        }
        
        // Try with specific status
        console.log('\n2️⃣ Trying with status 10 (WAITING_FOR_PAYMENT)...');
        try {
          const statusResponse = await httpClient.post('/v5/p2p/order/pending/simplifyList', {
            status: 10,
            page: 1,
            size: 50
          });
          console.log('   Response:', JSON.stringify(statusResponse.result, null, 2));
        } catch (error: any) {
          console.error('   Error:', error.message);
        }
        
        // Try all orders endpoint
        console.log('\n3️⃣ Trying /v5/p2p/order/simplifyList...');
        try {
          const allOrdersResponse = await httpClient.post('/v5/p2p/order/simplifyList', {
            page: 1,
            size: 20
          });
          console.log('   Response:', JSON.stringify(allOrdersResponse.result, null, 2));
        } catch (error: any) {
          console.error('   Error:', error.message);
        }
        
        // Try with time range (last 24 hours)
        console.log('\n4️⃣ Trying with time range (last 24 hours)...');
        const endTime = Date.now().toString();
        const beginTime = (Date.now() - 24 * 60 * 60 * 1000).toString();
        try {
          const timeRangeResponse = await httpClient.post('/v5/p2p/order/simplifyList', {
            beginTime,
            endTime,
            page: 1,
            size: 20
          });
          console.log('   Response:', JSON.stringify(timeRangeResponse.result, null, 2));
        } catch (error: any) {
          console.error('   Error:', error.message);
        }
        
        // Try to get my advertisements
        console.log('\n5️⃣ Getting my advertisements to find related orders...');
        try {
          const myAdsResponse = await httpClient.post('/v5/p2p/item/personal/list', {});
          console.log('   My Ads:', JSON.stringify(myAdsResponse.result, null, 2));
          
          // If we have ads, try to find orders for them
          if (myAdsResponse.result?.items && myAdsResponse.result.items.length > 0) {
            console.log('\n   Checking orders for each advertisement...');
            for (const ad of myAdsResponse.result.items) {
              console.log(`\n   Ad ${ad.id} (${ad.side === '0' ? 'BUY' : 'SELL'} ${ad.quantity} ${ad.tokenId}):`);
              
              // You might need to use web interface to see orders for specific ads
              // API doesn't seem to have a direct endpoint for this
            }
          }
        } catch (error: any) {
          console.error('   Error:', error.message);
        }
        
        // Try different order statuses
        console.log('\n6️⃣ Trying different order statuses...');
        const statuses = [5, 10, 20, 30, 40, 90, 100, 110];
        for (const status of statuses) {
          try {
            const statusResponse = await httpClient.post('/v5/p2p/order/simplifyList', {
              status,
              page: 1,
              size: 10
            });
            if (statusResponse.result?.count > 0) {
              console.log(`   Status ${status}: Found ${statusResponse.result.count} orders`);
              if (statusResponse.result.items && statusResponse.result.items.length > 0) {
                console.log('   Items:', JSON.stringify(statusResponse.result.items, null, 2));
              }
            }
          } catch (error: any) {
            // Ignore errors for specific statuses
          }
        }
        
      } catch (error) {
        console.error(`Error checking account ${account.accountId}:`, error);
      }
    }

    console.log('\n\n💡 Suggestions:');
    console.log('1. If API returns count > 0 but empty items, there might be a permission issue');
    console.log('2. Check if your API key has P2P trading permissions enabled');
    console.log('3. Try logging into Bybit web/app to see if orders are visible there');
    console.log('4. Orders might be in a different status than expected');
    console.log('5. Use get-order-by-id.ts if you know the specific order ID');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);