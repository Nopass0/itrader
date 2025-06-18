#!/usr/bin/env bun

/**
 * Find all active orders from Bybit
 */

import { db } from './src/db';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';
import { TimeSync } from './src/bybit/utils/timeSync';

async function findActiveOrders() {
  console.log('🔍 Finding active orders from Bybit...\n');

  try {
    // Sync time
    if (!TimeSync.isSynchronized()) {
      await TimeSync.forceSync();
    }

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    let totalOrdersFound = 0;
    let ordersToProcess = [];

    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('='.repeat(50));
      
      try {
        const client = bybitManager.getClient(account.accountId);
        const httpClient = (client as any).httpClient;
        
        // Try multiple approaches to find orders
        console.log('\n1️⃣ Checking pending orders endpoint...');
        try {
          const pendingResponse = await httpClient.post("/v5/p2p/order/pending/simplifyList", {
            page: 1,
            pageSize: 20,
          });
          
          if (pendingResponse.ret_code === 0 && pendingResponse.result) {
            console.log(`   Count: ${pendingResponse.result.count}`);
            if (pendingResponse.result.items && pendingResponse.result.items.length > 0) {
              console.log(`   ✅ Found ${pendingResponse.result.items.length} pending orders`);
              for (const order of pendingResponse.result.items) {
                totalOrdersFound++;
                await processOrder(order, account.accountId);
              }
            }
          }
        } catch (error: any) {
          console.log(`   ❌ Error: ${error.message || 'Unknown error'}`);
        }

        console.log('\n2️⃣ Checking regular orders endpoint...');
        try {
          const response = await httpClient.post("/v5/p2p/order/simplifyList", {
            page: 1,
            size: 20,
          });
          
          if (response.ret_code === 0 && response.result) {
            console.log(`   Count: ${response.result.count}`);
            
            // Handle different response structures
            let items = [];
            if (response.result.items && Array.isArray(response.result.items)) {
              items = response.result.items;
            } else if (response.result.result?.items && Array.isArray(response.result.result.items)) {
              items = response.result.result.items;
            }
            
            if (items.length > 0) {
              console.log(`   ✅ Found ${items.length} orders`);
              for (const order of items) {
                if ([10, 20].includes(order.status)) {
                  totalOrdersFound++;
                  await processOrder(order, account.accountId);
                }
              }
            }
          }
        } catch (error: any) {
          console.log(`   ❌ Error: ${error.message || 'Unknown error'}`);
        }

        console.log('\n3️⃣ Checking specific statuses...');
        const statuses = [10, 20]; // Active statuses
        for (const status of statuses) {
          try {
            const response = await httpClient.post("/v5/p2p/order/simplifyList", {
              page: 1,
              size: 20,
              status: status,
            });
            
            if (response.ret_code === 0 && response.result?.count > 0) {
              console.log(`   Status ${status} (${getStatusName(status)}): ${response.result.count} orders`);
            }
          } catch (error) {
            // Silent
          }
        }

        console.log('\n4️⃣ Using getPendingOrders method...');
        try {
          const pendingOrders = await client.getPendingOrders(1, 50);
          
          if (pendingOrders.list && pendingOrders.list.length > 0) {
            console.log(`   ✅ Found ${pendingOrders.list.length} orders via getPendingOrders`);
            for (const order of pendingOrders.list) {
              totalOrdersFound++;
              await processOrder(order, account.accountId);
            }
          } else {
            console.log(`   No orders found (count: ${pendingOrders.totalCount || 0})`);
          }
        } catch (error: any) {
          console.log(`   ❌ Error: ${error.message || 'Unknown error'}`);
        }

        console.log('\n5️⃣ Checking known order ID directly...');
        const knownOrderId = "1932450908748996608";
        try {
          const orderResponse = await httpClient.post("/v5/p2p/order/info", {
            orderId: knownOrderId,
          });
          
          if (orderResponse.ret_code === 0 && orderResponse.result?.result) {
            const order = orderResponse.result.result;
            console.log(`   ✅ Known order found! Status: ${order.status} (${getStatusName(order.status)})`);
            console.log(`   Amount: ${order.amount} ${order.currencyId}`);
            console.log(`   Item ID: ${order.itemId}`);
            
            totalOrdersFound++;
            await processOrder({
              id: order.id,
              status: order.status,
              amount: order.amount,
              currencyId: order.currencyId,
              price: order.price,
              targetNickName: order.targetNickName,
              itemId: order.itemId,
              userId: order.userId,
            }, account.accountId);
          }
        } catch (error: any) {
          console.log(`   Order not found on this account`);
        }
        
      } catch (error) {
        console.error(`Error checking account ${account.accountId}:`, error);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total orders found: ${totalOrdersFound}`);

    async function processOrder(order: any, accountId: string) {
      console.log(`\n   📦 Order ${order.id}`);
      console.log(`      Status: ${order.status} (${getStatusName(order.status)})`);
      console.log(`      Amount: ${order.amount} ${order.currencyId}`);
      console.log(`      Target: ${order.targetNickName || 'Unknown'}`);
      
      // Check if we have this order in DB
      const existingTransaction = await db.prisma.transaction.findFirst({
        where: { orderId: order.id },
        include: { 
          chatMessages: true,
          advertisement: true 
        }
      });
      
      if (existingTransaction) {
        console.log(`      ✅ Found in DB: Transaction ${existingTransaction.id}`);
        console.log(`      💬 Chat messages: ${existingTransaction.chatMessages.length}`);
        
        // Check if we need to initiate chat
        const hasOurMessages = existingTransaction.chatMessages.some(msg => msg.sender === 'us');
        if (!hasOurMessages) {
          console.log(`      ⚠️ No messages from us! Starting automation...`);
          try {
            await chatService.startAutomation(existingTransaction.id);
            console.log(`      ✅ Chat automation started`);
          } catch (error: any) {
            console.error(`      ❌ Error starting automation: ${error.message}`);
          }
        }
      } else {
        console.log(`      ❌ NOT IN DB! Creating transaction...`);
        
        try {
          // Create minimal advertisement if needed
          let advertisement = await db.prisma.advertisement.findFirst({
            where: {
              bybitAdId: order.itemId || order.id,
              bybitAccountId: accountId,
            },
          });
          
          if (!advertisement) {
            console.log(`      Creating advertisement...`);
            advertisement = await db.prisma.advertisement.create({
              data: {
                bybitAdId: order.itemId || order.id,
                bybitAccountId: accountId,
                side: "SELL",
                asset: "USDT",
                fiatCurrency: order.currencyId || "RUB",
                price: order.price || "79",
                quantity: "50",
                minOrderAmount: order.amount || "4013",
                maxOrderAmount: order.amount || "4013",
                paymentMethod: "Unknown",
                status: "ONLINE",
              },
            });
          }
          
          // Create transaction
          const transaction = await db.prisma.transaction.create({
            data: {
              advertisementId: advertisement.id,
              orderId: order.id,
              status: order.status === 10 ? "chat_started" : 
                     order.status === 20 ? "waiting_payment" : "pending",
              chatStep: 0,
            },
          });
          
          console.log(`      ✅ Created transaction ${transaction.id}`);
          
          // Start automation
          if (order.status === 10) {
            await chatService.startAutomation(transaction.id);
            console.log(`      ✅ Chat automation started`);
          }
        } catch (error: any) {
          console.error(`      ❌ Error creating transaction: ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.disconnect();
  }
}

function getStatusName(status: number): string {
  const map: Record<number, string> = {
    5: "waiting for chain",
    10: "waiting for buyer to pay",
    20: "waiting for seller to release",
    30: "appealing",
    40: "cancelled",
    50: "finished",
    60: "completed",
  };
  return map[status] || "unknown";
}

findActiveOrders().catch(console.error);