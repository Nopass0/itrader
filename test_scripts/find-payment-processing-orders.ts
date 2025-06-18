#!/usr/bin/env bun

/**
 * Find orders with "Payment Processing" status and send test message
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding orders with "Payment Processing" status...\n');

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    let ordersFound = [];

    for (const account of accounts) {
      console.log(`\n📋 Checking account: ${account.accountId}`);
      console.log('=' .repeat(60));
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Get ALL orders (not just pending)
        console.log('\n🔄 Fetching all recent orders...');
        const allOrders = await client.getOrders(undefined, 1, 50);
        
        console.log(`Total orders found: ${allOrders.list?.length || 0}`);
        
        if (allOrders.list && allOrders.list.length > 0) {
          // Status mapping for Bybit
          const statusMap: Record<number, string> = {
            5: 'WAITING_FOR_CHAIN',
            10: 'WAITING_FOR_PAYMENT', // Платеж в обработке
            20: 'WAITING_FOR_RELEASE', // Платеж получен
            30: 'APPEALING',
            40: 'COMPLETED',
            50: 'CANCELLED_BY_USER',
            60: 'CANCELLED_BY_SYSTEM',
            70: 'CANCELLED_BY_ADMIN',
            100: 'OBJECTIONING',
            110: 'WAITING_FOR_OBJECTION'
          };
          
          // Filter orders with payment processing status (10 or 20)
          const activeOrders = allOrders.list.filter(order => 
            order.status === 10 || order.status === 20
          );
          
          console.log(`\n✅ Found ${activeOrders.length} active orders with payment status`);
          
          for (const order of activeOrders) {
            console.log(`\n   📝 Order ID: ${order.id}`);
            console.log(`   Status: ${statusMap[order.status]} (${order.status})`);
            console.log(`   Side: ${order.side === 0 ? 'BUY' : 'SELL'}`);
            console.log(`   Amount: ${order.amount} ${order.currencyId}`);
            console.log(`   Price: ${order.price}`);
            console.log(`   Counterparty: ${order.targetNickName || 'Unknown'}`);
            console.log(`   Created: ${order.createDate ? new Date(parseInt(order.createDate)).toLocaleString() : 'Unknown'}`);
            
            // Get order details
            try {
              const orderDetails = await client.getOrderDetails(order.id);
              console.log(`   Item ID: ${orderDetails.itemId}`);
              
              // Check database
              let transaction = await prisma.transaction.findFirst({
                where: { orderId: order.id },
                include: { 
                  chatMessages: {
                    orderBy: { createdAt: 'desc' }
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
                        orderBy: { createdAt: 'desc' }
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
                  }
                }
              }
              
              if (transaction) {
                console.log(`   ✅ Transaction: ${transaction.id}`);
                console.log(`   📬 Chat messages: ${transaction.chatMessages.length}`);
                
                // Show recent messages
                if (transaction.chatMessages.length > 0) {
                  console.log(`   💬 Recent messages:`);
                  for (const msg of transaction.chatMessages.slice(0, 3)) {
                    console.log(`      [${msg.sender}] ${msg.content.substring(0, 60)}...`);
                  }
                }
                
                ordersFound.push({
                  order,
                  orderDetails,
                  transaction,
                  accountId: account.accountId
                });
              } else {
                console.log(`   ❌ No transaction found in database!`);
              }
              
              // Get chat messages from Bybit
              console.log(`\n   📨 Fetching chat messages from Bybit...`);
              const chatMessages = await client.getChatMessages(order.id, 1, 20);
              console.log(`   Chat messages from Bybit: ${chatMessages.list?.length || 0}`);
              
              if (chatMessages.list && chatMessages.list.length > 0) {
                console.log(`   Latest Bybit messages:`);
                for (const msg of chatMessages.list.slice(0, 3)) {
                  console.log(`      [${msg.senderId}] ${msg.content?.substring(0, 60) || 'No content'}...`);
                }
              }
              
            } catch (error) {
              console.error(`   ❌ Error getting order details:`, error);
            }
          }
        }
        
      } catch (error) {
        console.error(`Error checking account ${account.accountId}:`, error);
      }
    }

    // Process found orders
    if (ordersFound.length > 0) {
      console.log(`\n\n🚀 Processing ${ordersFound.length} active orders...\n`);
      
      for (const { order, orderDetails, transaction, accountId } of ordersFound) {
        console.log(`\n📝 Processing order ${order.id}`);
        
        if (!transaction) {
          console.log(`   ⚠️ Skipping - no transaction in database`);
          continue;
        }
        
        try {
          // Check if we need to send first message
          const hasOurMessages = transaction.chatMessages.some(msg => msg.sender === 'us');
          
          if (!hasOurMessages) {
            console.log(`   📤 Sending first message...`);
            await chatService.startAutomation(transaction.id);
            console.log(`   ✅ First message sent`);
          } else {
            console.log(`   ✅ Already has our messages`);
          }
          
          // Ensure chat polling is active
          console.log(`   🔄 Starting/ensuring chat polling...`);
          await bybitManager.startChatPolling(transaction.id);
          console.log(`   ✅ Chat polling active`);
          
          // Send test message
          console.log(`   📤 Sending test message...`);
          const testMessage = `Тестовое сообщение: Автоматический чат активирован. Время: ${new Date().toLocaleTimeString()}`;
          await bybitManager.sendChatMessage(transaction.id, testMessage);
          console.log(`   ✅ Test message sent`);
          
          // Process any unprocessed messages
          await chatService.processUnprocessedMessages();
          console.log(`   ✅ Processed unprocessed messages`);
          
        } catch (error) {
          console.error(`   ❌ Error processing order:`, error);
        }
      }
      
      console.log('\n\n✅ Automatic chat is now active for all orders!');
      console.log('The bot will:');
      console.log('1. Monitor for new messages');
      console.log('2. Ask security questions');
      console.log('3. Send payment details after correct answers');
      console.log('4. Process receipts when received');
      
    } else {
      console.log('\n⚠️ No active orders with payment processing status found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);