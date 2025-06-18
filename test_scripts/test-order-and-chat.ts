#!/usr/bin/env bun

/**
 * Test order fetching and chat automation
 */

import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';
import { ActiveOrdersMonitorService } from './src/services/activeOrdersMonitor';

async function main() {
  console.log('🔍 Testing order fetching and chat automation...\n');

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    const activeOrdersMonitor = new ActiveOrdersMonitorService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    // Test 1: Direct order fetching
    console.log('=' .repeat(60));
    console.log('TEST 1: Direct Order Fetching');
    console.log('=' .repeat(60));
    
    for (const account of accounts) {
      console.log(`\n📋 Testing account: ${account.accountId}`);
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Get all orders
        const allOrders = await client.getOrdersSimplified({
          page: 1,
          size: 20,
        });
        
        console.log(`Found ${allOrders.count} total orders`);
        
        if (allOrders.items && allOrders.items.length > 0) {
          console.log('\nOrder Details:');
          for (const order of allOrders.items) {
            console.log(`\n  📦 Order: ${order.id}`);
            console.log(`     Status: ${order.status}`);
            console.log(`     Amount: ${order.amount} ${order.currencyId}`);
            console.log(`     USDT: ${order.notifyTokenQuantity}`);
            console.log(`     Counterparty: ${order.targetNickName}`);
            
            // Test chat messages for active orders
            if (order.status === 10 || order.status === 20) {
              console.log(`\n     📨 Checking chat messages...`);
              
              try {
                const httpClient = (client as any).httpClient;
                const chatResponse = await httpClient.post("/v5/p2p/order/message/listpage", {
                  orderId: order.id,
                  size: "10",
                });
                
                // Handle both response structures
                let messages = [];
                if (chatResponse.result && Array.isArray(chatResponse.result)) {
                  messages = chatResponse.result;
                } else if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
                  messages = chatResponse.result.result;
                }
                
                console.log(`     Found ${messages.length} messages`);
                
                if (messages.length > 0 && messages[0]) {
                  console.log(`     Latest: ${messages[0].message?.substring(0, 60)}...`);
                }
              } catch (error) {
                console.log(`     Error fetching messages: ${error.message}`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error testing account ${account.accountId}:`, error);
      }
    }
    
    // Test 2: Active Orders Monitor
    console.log('\n\n' + '=' .repeat(60));
    console.log('TEST 2: Active Orders Monitor (One Check)');
    console.log('=' .repeat(60));
    
    // Do one check with the monitor
    await activeOrdersMonitor.startMonitoring(60000); // 60 second interval
    
    // Wait a bit for the check to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Stop monitoring
    await activeOrdersMonitor.stopMonitoring();
    
    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

main().catch(console.error);