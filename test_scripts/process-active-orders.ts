#!/usr/bin/env bun

/**
 * Find and process all orders with status 10 (payment processing) and 20 (waiting for coin release)
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';
import { HttpClient } from './src/bybit/utils/httpClient';

const prisma = new PrismaClient();

// Status mapping
const STATUS_MAP: Record<number, string> = {
  5: 'WAITING_FOR_CHAIN',
  10: 'WAITING_FOR_PAYMENT', // Платеж в обработке
  20: 'WAITING_FOR_RELEASE', // Ожидание перевода монет
  30: 'APPEALING',
  40: 'COMPLETED',
  50: 'CANCELLED_BY_USER',
  60: 'CANCELLED_BY_SYSTEM',
  70: 'CANCELLED_BY_ADMIN',
  90: 'WAITING_BUYER_SELECT_TOKEN',
  100: 'OBJECTIONING',
  110: 'WAITING_FOR_OBJECTION'
};

async function processOrder(
  order: any,
  accountId: string,
  bybitManager: BybitP2PManagerService,
  chatService: ChatAutomationService
) {
  console.log(`\n📝 Processing order ${order.id}`);
  console.log(`   Status: ${STATUS_MAP[order.status]} (${order.status})`);
  console.log(`   Amount: ${order.amount} ${order.currencyId}`);
  console.log(`   Created: ${new Date(parseInt(order.createDate)).toLocaleString()}`);

  try {
    const client = bybitManager.getClient(accountId);
    
    // Get full order details
    const orderDetails = await client.getOrderDetails(order.id);
    if (!orderDetails) {
      console.log(`   ❌ Failed to get order details`);
      return;
    }

    console.log(`   Item ID: ${orderDetails.itemId}`);
    console.log(`   Counterparty: ${orderDetails.targetNickName}`);

    // Find or create transaction
    let transaction = await prisma.transaction.findFirst({
      where: { orderId: order.id },
      include: { 
        chatMessages: {
          orderBy: { createdAt: 'asc' }
        },
        advertisement: true,
        payout: true
      }
    });

    if (!transaction) {
      console.log(`   ⚠️ Transaction not found by orderId, searching by advertisement...`);
      
      // Try to find by advertisement
      const advertisement = await prisma.bybitAdvertisement.findFirst({
        where: { bybitAdId: orderDetails.itemId }
      });
      
      if (advertisement) {
        transaction = await prisma.transaction.findFirst({
          where: { advertisementId: advertisement.id },
          include: { 
            chatMessages: {
              orderBy: { createdAt: 'asc' }
            },
            advertisement: true,
            payout: true
          }
        });
        
        if (transaction) {
          console.log(`   🔗 Found transaction by advertisement: ${transaction.id}`);
          
          // Update with order ID
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { 
              orderId: order.id,
              status: order.status === 10 ? 'waiting_payment' : 'payment_received'
            }
          });
          console.log(`   ✅ Updated transaction with order ID`);
        }
      }
    } else {
      console.log(`   ✅ Found transaction: ${transaction.id}`);
    }

    if (!transaction) {
      console.log(`   ❌ No transaction found for this order`);
      return;
    }

    // Get chat messages from Bybit
    console.log(`\n   📨 Fetching chat messages from Bybit...`);
    const chatMessages = await client.getChatMessages(order.id, 1, 50);
    console.log(`   Total messages from Bybit: ${chatMessages.list?.length || 0}`);
    
    // Sync messages to database
    if (chatMessages.list && chatMessages.list.length > 0) {
      for (const msg of chatMessages.list) {
        // Check if message already exists
        const existingMsg = await prisma.chatMessage.findFirst({
          where: {
            transactionId: transaction.id,
            messageId: msg.id
          }
        });
        
        if (!existingMsg && msg.message) {
          // Determine sender
          const sender = msg.userId === orderDetails.userId ? 'us' : 'counterparty';
          
          // Save message
          await prisma.chatMessage.create({
            data: {
              transactionId: transaction.id,
              messageId: msg.id,
              sender: sender,
              content: msg.message,
              messageType: msg.contentType === 'str' ? 'TEXT' : msg.contentType.toUpperCase(),
              isProcessed: sender === 'us' // Mark our messages as processed
            }
          });
          
          console.log(`   💾 Saved message: [${sender}] ${msg.message.substring(0, 50)}...`);
        }
      }
    }
    
    // Check current chat status
    const hasOurMessages = transaction.chatMessages.some(msg => msg.sender === 'us');
    const unprocessedMessages = transaction.chatMessages.filter(msg => 
      msg.sender === 'counterparty' && !msg.isProcessed
    );
    
    console.log(`\n   📊 Chat Status:`);
    console.log(`   Total messages in DB: ${transaction.chatMessages.length}`);
    console.log(`   Has our messages: ${hasOurMessages ? 'YES' : 'NO'}`);
    console.log(`   Unprocessed messages: ${unprocessedMessages.length}`);
    
    // Start chat automation if needed
    if (!hasOurMessages) {
      console.log(`\n   🤖 Starting chat automation...`);
      await chatService.startAutomation(transaction.id);
      console.log(`   ✅ First message sent`);
    }
    
    // Process unprocessed messages
    if (unprocessedMessages.length > 0) {
      console.log(`\n   🔄 Processing ${unprocessedMessages.length} unprocessed messages...`);
      await chatService.processUnprocessedMessages();
      console.log(`   ✅ Messages processed`);
    }
    
    // Ensure chat polling is active
    console.log(`\n   🔄 Ensuring chat polling is active...`);
    await bybitManager.startChatPolling(transaction.id);
    console.log(`   ✅ Chat polling active`);
    
    // Show latest messages
    const latestMessages = transaction.chatMessages.slice(-5);
    if (latestMessages.length > 0) {
      console.log(`\n   💬 Latest messages:`);
      for (const msg of latestMessages) {
        const time = new Date(msg.createdAt).toLocaleTimeString();
        console.log(`   [${time}] ${msg.sender}: ${msg.content.substring(0, 60)}...`);
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error processing order:`, error);
  }
}

async function main() {
  console.log('🔍 Finding and processing all active orders (status 10 & 20)...\n');

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    let totalOrdersProcessed = 0;

    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('=' .repeat(70));
      
      try {
        const client = bybitManager.getClient(account.accountId) as any;
        const httpClient = client.httpClient as HttpClient;
        
        // Try to get orders with different methods
        console.log('\n🔄 Method 1: Using pending orders endpoint...');
        let ordersToProcess = [];
        
        try {
          const pendingResponse = await httpClient.post('/v5/p2p/order/pending/simplifyList', {
            page: 1,
            size: 100
          });
          
          if (pendingResponse.result?.items && pendingResponse.result.items.length > 0) {
            console.log(`   Found ${pendingResponse.result.items.length} pending orders`);
            ordersToProcess.push(...pendingResponse.result.items);
          } else if (pendingResponse.result?.count > 0) {
            console.log(`   API shows ${pendingResponse.result.count} orders but items array is empty`);
          }
        } catch (error: any) {
          console.error('   Error:', error.message);
        }
        
        // Try all orders with status filter
        console.log('\n🔄 Method 2: Using all orders endpoint with status filter...');
        
        for (const status of [10, 20]) {
          try {
            const statusResponse = await httpClient.post('/v5/p2p/order/simplifyList', {
              status: status,
              page: 1,
              size: 100
            });
            
            if (statusResponse.result?.items && statusResponse.result.items.length > 0) {
              console.log(`   Found ${statusResponse.result.items.length} orders with status ${status}`);
              ordersToProcess.push(...statusResponse.result.items);
            }
          } catch (error: any) {
            console.error(`   Error for status ${status}:`, error.message);
          }
        }
        
        // Try without filters but check results
        console.log('\n🔄 Method 3: Getting all recent orders and filtering...');
        try {
          const allResponse = await httpClient.post('/v5/p2p/order/simplifyList', {
            page: 1,
            size: 100
          });
          
          if (allResponse.result?.items && allResponse.result.items.length > 0) {
            const activeOrders = allResponse.result.items.filter((order: any) => 
              order.status === 10 || order.status === 20
            );
            console.log(`   Found ${activeOrders.length} active orders out of ${allResponse.result.items.length} total`);
            ordersToProcess.push(...activeOrders);
          }
        } catch (error: any) {
          console.error('   Error:', error.message);
        }
        
        // Remove duplicates
        const uniqueOrders = Array.from(
          new Map(ordersToProcess.map(order => [order.id, order])).values()
        );
        
        console.log(`\n✅ Total unique orders to process: ${uniqueOrders.length}`);
        
        // Process each order
        for (const order of uniqueOrders) {
          await processOrder(order, account.accountId, bybitManager, chatService);
          totalOrdersProcessed++;
        }
        
      } catch (error) {
        console.error(`Error checking account ${account.accountId}:`, error);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total orders processed: ${totalOrdersProcessed}`);
    
    if (totalOrdersProcessed === 0) {
      console.log('\n⚠️ No active orders found!');
      console.log('\nPossible reasons:');
      console.log('1. There are no orders with status 10 or 20');
      console.log('2. API key permissions issue');
      console.log('3. Orders are in different status');
      console.log('\nTry:');
      console.log('1. Check Bybit web interface for active orders');
      console.log('2. Use get-order-by-id.ts with specific order ID');
      console.log('3. Check API key permissions in Bybit settings');
    } else {
      console.log('\n✅ Chat automation is now active for all processed orders!');
    }

    // Start continuous monitoring
    console.log('\n\n🔄 Starting continuous monitoring...');
    console.log('Press Ctrl+C to stop\n');
    
    // Monitor loop
    let iteration = 0;
    while (true) {
      iteration++;
      
      if (iteration % 6 === 1) { // Every minute
        console.log(`\n[${new Date().toLocaleTimeString()}] Checking for new orders...`);
        
        for (const account of accounts) {
          try {
            const client = bybitManager.getClient(account.accountId) as any;
            const httpClient = client.httpClient as HttpClient;
            
            const pendingResponse = await httpClient.post('/v5/p2p/order/pending/simplifyList', {
              page: 1,
              size: 20
            });
            
            if (pendingResponse.result?.items && pendingResponse.result.items.length > 0) {
              console.log(`   [${account.accountId}] Found ${pendingResponse.result.items.length} orders`);
              
              for (const order of pendingResponse.result.items) {
                await processOrder(order, account.accountId, bybitManager, chatService);
              }
            }
          } catch (error) {
            // Silent error in monitoring loop
          }
        }
      }
      
      // Process unprocessed messages
      await chatService.processUnprocessedMessages();
      
      // Wait 10 seconds
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);