#!/usr/bin/env bun

/**
 * Check all transactions in database
 */

import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🗄️ Checking all transactions in database...\n');

  try {
    // Get all transactions
    const allTransactions = await prisma.transaction.findMany({
      include: {
        advertisement: true,
        payout: true,
        chatMessages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Total transactions: ${allTransactions.length}\n`);

    // Group by status
    const byStatus = allTransactions.reduce((acc, tx) => {
      acc[tx.status] = (acc[tx.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Transactions by status:');
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`  ${status}: ${count}`);
    }
    console.log('');

    // Show recent transactions
    console.log('Recent transactions:');
    console.log('=' .repeat(100));
    
    for (const tx of allTransactions.slice(0, 10)) {
      console.log(`\n📋 Transaction ${tx.id}`);
      console.log(`   Created: ${tx.createdAt.toLocaleString()}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Order ID: ${tx.orderId || 'NO ORDER'}`);
      console.log(`   Advertisement: ${tx.advertisement.bybitAdId} (${tx.advertisement.status})`);
      console.log(`   Bybit Account: ${tx.advertisement.bybitAccountId}`);
      console.log(`   Payment Method: ${tx.advertisement.paymentMethod}`);
      console.log(`   Amount: ${tx.advertisement.minOrderAmount} RUB`);
      
      // Parse payout totalTrader
      const totalTrader = typeof tx.payout.totalTrader === 'string' 
        ? JSON.parse(tx.payout.totalTrader) 
        : tx.payout.totalTrader;
      console.log(`   Payout Amount: ${totalTrader['643']} RUB`);
      console.log(`   Gate Payout ID: ${tx.payout.gatePayoutId}`);
      console.log(`   Chat Messages: ${tx.chatMessages.length}`);
      
      if (tx.chatMessages.length > 0) {
        console.log('   Latest messages:');
        for (const msg of tx.chatMessages.slice(-3)) {
          const time = new Date(msg.createdAt).toLocaleTimeString();
          console.log(`     [${time}] ${msg.sender}: ${msg.content.substring(0, 50)}...`);
        }
      }
      
      if (tx.orderId) {
        console.log(`   ✅ HAS ORDER ID: ${tx.orderId}`);
      } else {
        console.log(`   ⚠️ NO ORDER ID!`);
      }
    }

    // Check active transactions without orders
    const activeWithoutOrders = allTransactions.filter(tx => 
      !tx.orderId && 
      ['pending', 'chat_started', 'waiting_payment'].includes(tx.status)
    );

    if (activeWithoutOrders.length > 0) {
      console.log(`\n\n⚠️ Active transactions WITHOUT orders: ${activeWithoutOrders.length}`);
      for (const tx of activeWithoutOrders) {
        console.log(`   - ${tx.id} (Status: ${tx.status}, Created: ${tx.createdAt.toLocaleString()})`);
      }
    }

    // Check transactions with orders
    const withOrders = allTransactions.filter(tx => tx.orderId);
    console.log(`\n\n✅ Transactions WITH orders: ${withOrders.length}`);
    
    if (withOrders.length > 0) {
      console.log('\nTransactions with orders:');
      for (const tx of withOrders) {
        const hasOurMessages = tx.chatMessages.some(msg => msg.sender === 'us');
        console.log(`   - ${tx.id}`);
        console.log(`     Order: ${tx.orderId}`);
        console.log(`     Status: ${tx.status}`);
        console.log(`     Messages: ${tx.chatMessages.length} (Has our messages: ${hasOurMessages ? 'YES' : 'NO'})`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);