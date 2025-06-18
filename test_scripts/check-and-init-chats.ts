#!/usr/bin/env bun

/**
 * Check all orders and initiate chat if needed
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking all orders and initiating chats...\n');

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    // Get all transactions with orders
    const transactions = await prisma.transaction.findMany({
      where: {
        orderId: { not: null },
        status: {
          notIn: ['completed', 'failed', 'blacklisted']
        }
      },
      include: {
        advertisement: true,
        payout: true,
        chatMessages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    console.log(`Found ${transactions.length} active transactions with orders\n`);

    for (const transaction of transactions) {
      console.log(`\n📋 Transaction ${transaction.id}:`);
      console.log(`   Order ID: ${transaction.orderId}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Advertisement: ${transaction.advertisement.bybitAdId}`);
      console.log(`   Bybit Account: ${transaction.advertisement.bybitAccountId}`);
      console.log(`   Chat Messages: ${transaction.chatMessages.length}`);
      
      // Check if we need to initiate chat
      const hasOurMessages = transaction.chatMessages.some(msg => msg.sender === 'us');
      
      if (transaction.chatMessages.length === 0 || !hasOurMessages) {
        console.log(`\n   ⚠️ No chat messages from us found. Initiating chat...`);
        
        try {
          // Start chat automation - this will send the first message
          await chatService.startAutomation(transaction.id);
          console.log(`   ✅ First message sent`);
          
          // Update transaction status if needed
          if (transaction.status === 'pending') {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'chat_started' }
            });
            console.log(`   ✅ Transaction status updated to chat_started`);
          }
          
          // Start chat polling
          await bybitManager.startChatPolling(transaction.id);
          console.log(`   ✅ Chat polling started`);
          
        } catch (error) {
          console.error(`   ❌ Error initiating chat:`, error);
        }
      } else {
        console.log(`\n   ✅ Chat already initiated`);
        
        // Show latest messages
        const latestMessages = transaction.chatMessages.slice(-3);
        console.log(`\n   Latest messages:`);
        for (const msg of latestMessages) {
          const time = new Date(msg.createdAt).toLocaleTimeString();
          console.log(`   [${time}] ${msg.sender}: ${msg.content.substring(0, 60)}...`);
        }
        
        // Make sure chat polling is active
        await bybitManager.startChatPolling(transaction.id);
        console.log(`   ✅ Chat polling ensured`);
      }
    }

    // Process any unprocessed messages
    console.log('\n\n🤖 Processing unprocessed messages...');
    await chatService.processUnprocessedMessages();
    
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);