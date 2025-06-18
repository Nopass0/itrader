#!/usr/bin/env bun

/**
 * Test script to manually send a chat message
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: bun run test-send-chat-message.ts <transactionId> <message>');
    console.log('Example: bun run test-send-chat-message.ts cm5l4zj7h000308l62qw7bbgm "Test message"');
    
    // Show available transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        orderId: { not: null },
        status: { in: ['chat_started', 'waiting_payment'] }
      },
      select: {
        id: true,
        orderId: true,
        status: true
      }
    });
    
    if (transactions.length > 0) {
      console.log('\nAvailable transactions:');
      for (const tx of transactions) {
        console.log(`- ${tx.id} (Order: ${tx.orderId}, Status: ${tx.status})`);
      }
    }
    
    process.exit(1);
  }

  const [transactionId, message] = args;

  try {
    // Get transaction details
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        advertisement: true
      }
    });

    if (!transaction) {
      console.error('❌ Transaction not found');
      process.exit(1);
    }

    if (!transaction.orderId) {
      console.error('❌ Transaction has no order ID');
      process.exit(1);
    }

    console.log(`📋 Transaction ${transactionId}:`);
    console.log(`   Order ID: ${transaction.orderId}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Bybit Account: ${transaction.advertisement.bybitAccountId}`);

    // Initialize Bybit manager
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();

    // Send message
    console.log(`\n📤 Sending message: "${message}"`);
    await bybitManager.sendChatMessage(transactionId, message);

    console.log('✅ Message sent successfully');

    // Check recent messages
    const recentMessages = await prisma.chatMessage.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\n📬 Recent messages (${recentMessages.length}):`);
    for (const msg of recentMessages) {
      const time = new Date(msg.createdAt).toLocaleTimeString();
      console.log(`[${time}] ${msg.sender}: ${msg.content}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);