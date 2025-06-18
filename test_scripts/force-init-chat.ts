#!/usr/bin/env bun

/**
 * Force initialize chat for a specific transaction or order
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: bun run force-init-chat.ts <transactionId or orderId>');
    
    // Show available transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        orderId: { not: null },
        status: { notIn: ['completed', 'failed', 'blacklisted'] }
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        _count: {
          select: { chatMessages: true }
        }
      }
    });
    
    if (transactions.length > 0) {
      console.log('\nAvailable transactions:');
      for (const tx of transactions) {
        console.log(`- ${tx.id} (Order: ${tx.orderId}, Status: ${tx.status}, Messages: ${tx._count.chatMessages})`);
      }
    }
    
    process.exit(1);
  }

  const [identifier] = args;

  try {
    // Find transaction by ID or order ID
    let transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { id: identifier },
          { orderId: identifier }
        ]
      },
      include: {
        advertisement: true,
        payout: true,
        chatMessages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!transaction) {
      console.error('❌ Transaction not found');
      process.exit(1);
    }

    console.log(`\n📋 Transaction ${transaction.id}:`);
    console.log(`   Order ID: ${transaction.orderId}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Advertisement: ${transaction.advertisement.bybitAdId}`);
    console.log(`   Chat Messages: ${transaction.chatMessages.length}`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);

    // Update status if needed
    if (transaction.status === 'pending' && transaction.orderId) {
      console.log('\n🔄 Updating transaction status to chat_started...');
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'chat_started' }
      });
    }

    // Send first message
    console.log('\n📤 Sending first message...');
    await chatService.startAutomation(transaction.id);
    console.log('✅ First message sent');

    // Start chat polling
    if (transaction.orderId) {
      console.log('\n🔄 Starting chat polling...');
      await bybitManager.startChatPolling(transaction.id);
      console.log('✅ Chat polling started');
    }

    // Wait a bit for message to be saved
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show recent messages
    const recentMessages = await prisma.chatMessage.findMany({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\n📬 Recent messages (${recentMessages.length}):`);
    for (const msg of recentMessages.reverse()) {
      const time = new Date(msg.createdAt).toLocaleTimeString();
      console.log(`[${time}] ${msg.sender}: ${msg.content}`);
    }

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);