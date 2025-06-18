#!/usr/bin/env bun

/**
 * Monitor chat messages in real-time
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';

const prisma = new PrismaClient();

async function main() {
  console.log('👁️ Monitoring chats in real-time...\n');
  console.log('Press Ctrl+C to stop\n');

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    // Track processed message IDs
    const processedMessages = new Set<string>();
    
    // Initial load of existing messages
    const existingMessages = await prisma.chatMessage.findMany({
      select: { id: true }
    });
    existingMessages.forEach(msg => processedMessages.add(msg.id));
    
    console.log(`Starting with ${processedMessages.size} existing messages\n`);
    
    // Monitor loop
    while (true) {
      try {
        // Get active transactions
        const activeTransactions = await prisma.transaction.findMany({
          where: {
            orderId: { not: null },
            status: {
              in: ['chat_started', 'waiting_payment', 'payment_received']
            }
          },
          include: {
            chatMessages: {
              orderBy: { createdAt: 'desc' },
              take: 10
            },
            advertisement: true
          }
        });
        
        // Check for new messages
        for (const transaction of activeTransactions) {
          for (const message of transaction.chatMessages) {
            if (!processedMessages.has(message.id)) {
              // New message!
              const time = new Date(message.createdAt).toLocaleTimeString();
              console.log(`\n🆕 NEW MESSAGE in transaction ${transaction.id}:`);
              console.log(`   Time: ${time}`);
              console.log(`   Sender: ${message.sender}`);
              console.log(`   Content: ${message.content}`);
              console.log(`   Processed: ${message.isProcessed ? 'Yes' : 'No'}`);
              
              processedMessages.add(message.id);
              
              // If it's from counterparty and not processed, process it
              if (message.sender === 'counterparty' && !message.isProcessed) {
                console.log(`   🤖 Processing message...`);
                await chatService.processUnprocessedMessages();
              }
            }
          }
        }
        
        // Show summary every 30 seconds
        if (Date.now() % 30000 < 5000) {
          console.log(`\n📊 Status: ${activeTransactions.length} active transactions`);
          for (const tx of activeTransactions) {
            const unprocessed = tx.chatMessages.filter(m => !m.isProcessed && m.sender === 'counterparty').length;
            console.log(`   - ${tx.id}: ${tx.chatMessages.length} messages (${unprocessed} unprocessed)`);
          }
        }
        
        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);