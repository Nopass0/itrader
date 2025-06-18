#!/usr/bin/env bun

/**
 * Process active orders with improved time sync
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';
import { TimeSync } from './src/bybit/utils/timeSync';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Processing active orders with improved time sync...\n');

  try {
    // Force time sync before starting
    console.log('🕐 Synchronizing time with Bybit server...');
    await TimeSync.forceSync(false);
    console.log(`Time offset: ${TimeSync.getOffset()}ms`);
    console.log(`Synchronized: ${TimeSync.isSynchronized()}\n`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    // Main processing loop
    while (true) {
      console.log(`\n[${new Date().toLocaleTimeString()}] Checking orders...`);
      
      // Re-sync time every 5 minutes
      if (Date.now() % (5 * 60 * 1000) < 30000) {
        await TimeSync.forceSync(false);
        console.log(`Time re-synced. Offset: ${TimeSync.getOffset()}ms`);
      }

      for (const account of accounts) {
        try {
          const client = bybitManager.getClient(account.accountId);
          
          // Get pending orders
          console.log(`\nChecking ${account.accountId}...`);
          const pendingOrders = await client.getPendingOrders(1, 50);
          
          if (pendingOrders.list && pendingOrders.list.length > 0) {
            console.log(`Found ${pendingOrders.list.length} pending orders`);
            
            for (const order of pendingOrders.list) {
              if (order.status === 10 || order.status === 20) {
                await processOrder(order, account.accountId, bybitManager, chatService);
              }
            }
          }
          
          // Also get all recent orders
          const allOrders = await client.getOrders(undefined, 1, 50);
          if (allOrders.list) {
            const activeOrders = allOrders.list.filter(o => o.status === 10 || o.status === 20);
            console.log(`Found ${activeOrders.length} active orders in all orders`);
            
            for (const order of activeOrders) {
              await processOrder(order, account.accountId, bybitManager, chatService);
            }
          }
          
        } catch (error: any) {
          if (error.message?.includes('timestamp')) {
            console.error(`Time sync error for ${account.accountId}, re-syncing...`);
            await TimeSync.forceSync(false);
          } else {
            console.error(`Error checking ${account.accountId}:`, error.message);
          }
        }
      }

      // Process unprocessed messages
      await chatService.processUnprocessedMessages();
      
      // Wait 30 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function processOrder(
  order: any,
  accountId: string,
  bybitManager: BybitP2PManagerService,
  chatService: ChatAutomationService
) {
  console.log(`\n📝 Processing order ${order.id} (Status: ${order.status})`);

  try {
    // Find transaction
    let transaction = await prisma.transaction.findFirst({
      where: { orderId: order.id },
      include: { 
        chatMessages: true,
        advertisement: true,
        payout: true
      }
    });

    if (!transaction) {
      // Try to find by order details
      const client = bybitManager.getClient(accountId);
      const orderDetails = await client.getOrderDetails(order.id);
      
      if (orderDetails?.itemId) {
        const advertisement = await prisma.bybitAdvertisement.findFirst({
          where: { bybitAdId: orderDetails.itemId }
        });
        
        if (advertisement) {
          transaction = await prisma.transaction.findFirst({
            where: { advertisementId: advertisement.id },
            include: { 
              chatMessages: true,
              advertisement: true,
              payout: true
            }
          });
          
          if (transaction) {
            // Update with order ID
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { 
                orderId: order.id,
                status: order.status === 10 ? 'waiting_payment' : 'payment_received'
              }
            });
          }
        }
      }
    }

    if (!transaction) {
      console.log(`   ❌ No transaction found`);
      return;
    }

    // Sync chat messages
    const client = bybitManager.getClient(accountId);
    const chatMessages = await client.getChatMessages(order.id, 1, 50);
    
    if (chatMessages.list) {
      console.log(`   📨 Found ${chatMessages.list.length} chat messages`);
      
      // Sync to database
      for (const msg of chatMessages.list) {
        if (!msg.message) continue;
        
        const exists = await prisma.chatMessage.findFirst({
          where: {
            transactionId: transaction.id,
            messageId: msg.id || msg.msgUuid || `${msg.createDate}_${msg.userId}`
          }
        });
        
        if (!exists) {
          const sender = msg.userId === msg.accountId ? 'us' : 'counterparty';
          await prisma.chatMessage.create({
            data: {
              transactionId: transaction.id,
              messageId: msg.id || msg.msgUuid || `${msg.createDate}_${msg.userId}`,
              sender: sender,
              content: msg.message,
              messageType: 'TEXT',
              isProcessed: sender === 'us'
            }
          });
          console.log(`   💾 New message: [${sender}] ${msg.message.substring(0, 50)}...`);
        }
      }
    }

    // Check if needs automation
    const hasOurMessages = transaction.chatMessages.some(msg => msg.sender === 'us');
    if (!hasOurMessages) {
      console.log(`   🤖 Starting chat automation...`);
      await chatService.startAutomation(transaction.id);
    }

    // Ensure chat polling
    await bybitManager.startChatPolling(transaction.id);
    console.log(`   ✅ Order processed`);

  } catch (error) {
    console.error(`   ❌ Error:`, error);
  }
}

main().catch(console.error);