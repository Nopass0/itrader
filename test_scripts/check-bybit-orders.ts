#!/usr/bin/env bun

/**
 * Check Bybit orders directly via API
 */

import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Bybit orders directly...\n');

  try {
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('=' .repeat(50));
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Get pending orders
        console.log('\n🔄 Pending Orders:');
        // Use getPendingOrders method instead of raw request
        const pendingResponse = await client.getPendingOrders(1, 20);
        
        if (pendingResponse.list && pendingResponse.list.length > 0) {
          for (const order of pendingResponse.list) {
            console.log(`\n   Order ID: ${order.id}`);
            console.log(`   Status: ${order.status}`);
            console.log(`   Amount: ${order.amount} ${order.currencyId}`);
            console.log(`   Price: ${order.price}`);
            console.log(`   Counterparty: ${order.targetNickName}`);
            console.log(`   Created: ${new Date(parseInt(order.createDate)).toLocaleString()}`);
            
            // Check if we have this order in DB
            const transaction = await prisma.transaction.findFirst({
              where: { orderId: order.id },
              include: { chatMessages: true }
            });
            
            if (transaction) {
              console.log(`   ✅ Found in DB: Transaction ${transaction.id}`);
              console.log(`   📬 Chat messages: ${transaction.chatMessages.length}`);
            } else {
              console.log(`   ⚠️ NOT FOUND IN DB!`);
            }
          }
        } else {
          console.log('   No pending orders');
        }
        
        // Get all orders
        console.log('\n📊 All Recent Orders:');
        // Use getOrders method instead of raw request
        const allOrdersResponse = await client.getOrders(undefined, 1, 10);
        
        if (allOrdersResponse.list && allOrdersResponse.list.length > 0) {
          for (const order of allOrdersResponse.list) {
            const statusMap: Record<number, string> = {
              5: 'WAITING_FOR_CHAIN',
              10: 'WAITING_FOR_PAYMENT',
              20: 'WAITING_FOR_RELEASE',
              30: 'APPEALING',
              40: 'COMPLETED',
              50: 'CANCELLED_BY_USER',
              60: 'CANCELLED_BY_SYSTEM',
              70: 'CANCELLED_BY_ADMIN',
              100: 'OBJECTIONING',
              110: 'WAITING_FOR_OBJECTION'
            };
            
            console.log(`\n   Order ID: ${order.id}`);
            console.log(`   Status: ${statusMap[order.status] || order.status}`);
            console.log(`   Side: ${order.side === 0 ? 'BUY' : 'SELL'}`);
            console.log(`   Amount: ${order.amount} ${order.currencyId}`);
            console.log(`   Created: ${new Date(parseInt(order.createDate)).toLocaleString()}`);
          }
        } else {
          console.log('   No orders found');
        }
        
      } catch (error) {
        console.error(`Error checking account ${account.accountId}:`, error);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);