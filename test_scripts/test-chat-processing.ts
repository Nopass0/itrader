#!/usr/bin/env bun

/**
 * Test script to check chat processing for active orders
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Testing chat processing...\n');

  try {
    // Get active transactions with orders
    const activeTransactions = await prisma.transaction.findMany({
      where: {
        orderId: { not: null },
        status: {
          in: ['chat_started', 'waiting_payment', 'payment_received']
        }
      },
      include: {
        advertisement: true,
        payout: true,
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    console.log(`Found ${activeTransactions.length} active transactions with orders:\n`);

    for (const transaction of activeTransactions) {
      console.log(`📋 Transaction ${transaction.id}:`);
      console.log(`   Order ID: ${transaction.orderId}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Advertisement: ${transaction.advertisement.bybitAdId}`);
      console.log(`   Bybit Account: ${transaction.advertisement.bybitAccountId}`);
      console.log(`   Chat Messages: ${transaction.chatMessages.length}`);
      
      if (transaction.chatMessages.length > 0) {
        console.log('\n   Latest messages:');
        for (const msg of transaction.chatMessages) {
          console.log(`   - [${msg.sender}] ${msg.content.substring(0, 50)}...`);
        }
      }
      console.log('');
    }

    // Check unprocessed chat messages
    const unprocessedMessages = await prisma.chatMessage.findMany({
      where: { isProcessed: false },
      include: {
        transaction: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`\n📬 Unprocessed chat messages: ${unprocessedMessages.length}`);
    
    if (unprocessedMessages.length > 0) {
      console.log('\nUnprocessed messages:');
      for (const msg of unprocessedMessages) {
        console.log(`- Transaction ${msg.transactionId}: [${msg.sender}] ${msg.content.substring(0, 50)}...`);
      }
    }

    // Test chat automation
    if (activeTransactions.length > 0) {
      console.log('\n🤖 Testing chat automation...');
      
      const bybitManager = new BybitP2PManagerService();
      await bybitManager.initialize();
      
      const chatService = new ChatAutomationService(bybitManager);
      
      // Process unprocessed messages
      await chatService.processUnprocessedMessages();
      
      console.log('✅ Chat automation test complete');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);