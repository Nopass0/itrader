#!/usr/bin/env bun

/**
 * Test order fetching with simplifyList endpoint
 */

import { BybitP2PManagerService } from '../src/services/bybitP2PManager';

async function main() {
  console.log('🔍 Testing order fetching with simplifyList endpoint...\n');

  try {
    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`\n📋 Testing account: ${account.accountId}`);
      console.log('=' .repeat(50));
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Test 1: Get all orders without status filter
        console.log('\n1️⃣ Getting all orders (no status filter)...');
        const allOrders = await client.getOrdersSimplified({
          page: 1,
          size: 20,
        });
        
        console.log(`  ✓ Found ${allOrders.count} total orders`);
        console.log(`  ✓ Retrieved ${allOrders.items.length} items`);
        
        if (allOrders.items.length > 0) {
          console.log('\n  Order statuses found:');
          const statusCounts = new Map();
          for (const order of allOrders.items) {
            const count = statusCounts.get(order.status) || 0;
            statusCounts.set(order.status, count + 1);
          }
          
          for (const [status, count] of statusCounts) {
            console.log(`    - Status ${status}: ${count} order(s)`);
          }
          
          // Show first order details
          const firstOrder = allOrders.items[0];
          console.log('\n  First order details:');
          console.log(`    ID: ${firstOrder.id}`);
          console.log(`    Status: ${firstOrder.status}`);
          console.log(`    Amount: ${firstOrder.amount} ${firstOrder.currencyId}`);
          console.log(`    Created: ${firstOrder.createDate ? new Date(parseInt(firstOrder.createDate)).toLocaleString() : 'Unknown'}`);
        }
        
        // Test 2: Get orders with status 10
        console.log('\n2️⃣ Getting orders with status 10 (Payment in processing)...');
        const status10Orders = await client.getOrdersSimplified({
          page: 1,
          size: 20,
          status: 10,
        });
        
        console.log(`  ✓ Found ${status10Orders.count} orders with status 10`);
        console.log(`  ✓ Retrieved ${status10Orders.items.length} items`);
        
        // Test 3: Get orders with status 20
        console.log('\n3️⃣ Getting orders with status 20 (Waiting for coin transfer)...');
        const status20Orders = await client.getOrdersSimplified({
          page: 1,
          size: 20,
          status: 20,
        });
        
        console.log(`  ✓ Found ${status20Orders.count} orders with status 20`);
        console.log(`  ✓ Retrieved ${status20Orders.items.length} items`);
        
        // Test 4: Compare with legacy getPendingOrders method
        console.log('\n4️⃣ Comparing with legacy getPendingOrders method...');
        const pendingOrders = await client.getPendingOrders(1, 50);
        
        console.log(`  ✓ Legacy method found ${pendingOrders.totalCount || 0} orders`);
        console.log(`  ✓ Retrieved ${pendingOrders.list?.length || 0} items`);
        
      } catch (error) {
        console.error(`\n❌ Error testing account ${account.accountId}:`, error);
      }
    }

    console.log('\n\n✅ Order fetching test completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

main().catch(console.error);