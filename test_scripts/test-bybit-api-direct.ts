#!/usr/bin/env bun
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { TimeSync } from './src/bybit/utils/timeSync';

async function main() {
  console.log('🔍 Testing Bybit API directly...\n');

  try {
    // Force time sync
    await TimeSync.forceSync(false);
    console.log(`Time offset: ${TimeSync.getOffset()}ms\n`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    if (accounts.length === 0) {
      console.log('No active accounts found');
      return;
    }

    const account = accounts[0];
    console.log(`Using account: ${account.accountId}\n`);
    
    const client = bybitManager.getClient(account.accountId);
    const httpClient = (client as any).httpClient;
    
    // Test 1: simplifyList with exact params from docs
    console.log('Test 1: /v5/p2p/order/simplifyList');
    try {
      const response = await httpClient.post('/v5/p2p/order/simplifyList', {
        "status": null,
        "beginTime": null,
        "endTime": null,
        "tokenId": null,
        "side": null,
        "page": 1,
        "size": 20
      });
      console.log('Success:', JSON.stringify(response.result, null, 2));
    } catch (error: any) {
      console.error('Error:', error.message);
      if (error.details) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
      }
    }
    
    // Test 2: pending/simplifyList
    console.log('\n\nTest 2: /v5/p2p/order/pending/simplifyList');
    try {
      const response = await httpClient.post('/v5/p2p/order/pending/simplifyList', {
        "status": null,
        "beginTime": null,
        "endTime": null,
        "tokenId": null,
        "side": null,
        "page": 1,
        "size": 20
      });
      console.log('Success:', JSON.stringify(response.result, null, 2));
    } catch (error: any) {
      console.error('Error:', error.message);
      if (error.details) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
      }
    }
    
    // Test 3: Try without null values
    console.log('\n\nTest 3: Without null values');
    try {
      const response = await httpClient.post('/v5/p2p/order/simplifyList', {
        "page": 1,
        "size": 20
      });
      console.log('Success:', JSON.stringify(response.result, null, 2));
    } catch (error: any) {
      console.error('Error:', error.message);
    }
    
    // Test 4: Try with empty strings instead of null
    console.log('\n\nTest 4: With empty strings');
    try {
      const response = await httpClient.post('/v5/p2p/order/simplifyList', {
        "status": "",
        "beginTime": "",
        "endTime": "",
        "tokenId": "",
        "side": "",
        "page": 1,
        "size": 20
      });
      console.log('Success:', JSON.stringify(response.result, null, 2));
    } catch (error: any) {
      console.error('Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

main().catch(console.error);