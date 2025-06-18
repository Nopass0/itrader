#!/usr/bin/env bun

/**
 * Get order details by ID
 */

import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { PrismaClient } from './generated/prisma';
import { ChatAutomationService } from './src/services/chatAutomation';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: bun run get-order-by-id.ts <orderId>');
    console.log('Example: bun run get-order-by-id.ts 1900004704665923584');
    console.log('\nIf you don\'t know the order ID, check:');
    console.log('1. Your Bybit P2P order history in the web/app');
    console.log('2. Database transactions with: bun run check-transactions-db.ts');
    process.exit(1);
  }

  const orderId = args[0];

  try {
    console.log(`🔍 Getting details for order ${orderId}...\n`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    let orderFound = false;

    for (const account of accounts) {
      console.log(`\n📋 Checking account: ${account.accountId}`);
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Get order details
        console.log('\n🔄 Fetching order details...');
        const orderDetails = await client.getOrderDetails(orderId);
        
        if (orderDetails) {
          orderFound = true;
          console.log('\n✅ Order found!');
          console.log(JSON.stringify(orderDetails, null, 2));
          
          // Map status
          const statusMap: Record<number, string> = {
            5: 'WAITING_FOR_CHAIN',
            10: 'WAITING_FOR_PAYMENT',
            20: 'WAITING_FOR_RELEASE',
            30: 'APPEALING',
            40: 'COMPLETED',
            50: 'CANCELLED_BY_USER',
            60: 'CANCELLED_BY_SYSTEM',
            70: 'CANCELLED_BY_ADMIN',
            90: 'WAITING_BUYER_SELECT_TOKEN',
            100: 'OBJECTIONING',
            110: 'WAITING_FOR_OBJECTION'
          };
          
          console.log(`\n📊 Order Summary:`);
          console.log(`   ID: ${orderDetails.id}`);
          console.log(`   Status: ${statusMap[orderDetails.status] || orderDetails.status}`);
          console.log(`   Side: ${orderDetails.side === 0 ? 'BUY' : 'SELL'}`);
          console.log(`   Amount: ${orderDetails.amount} ${orderDetails.currencyId}`);
          console.log(`   Price: ${orderDetails.price}`);
          console.log(`   Token: ${orderDetails.tokenId} (${orderDetails.quantity})`);
          console.log(`   Item ID: ${orderDetails.itemId}`);
          console.log(`   Counterparty: ${orderDetails.targetNickName} (${orderDetails.targetUserId})`);
          console.log(`   Created: ${new Date(parseInt(orderDetails.createDate)).toLocaleString()}`);
          
          // Check database
          let transaction = await prisma.transaction.findFirst({
            where: { orderId: orderDetails.id },
            include: { 
              chatMessages: {
                orderBy: { createdAt: 'desc' }
              },
              advertisement: true,
              payout: true
            }
          });
          
          if (!transaction) {
            console.log(`\n⚠️ Transaction not found by orderId, searching by advertisement...`);
            
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
                    orderId: orderDetails.id,
                    status: orderDetails.status === 10 ? 'waiting_payment' : 'payment_received'
                  }
                });
                console.log(`   ✅ Updated transaction with order ID`);
              }
            }
          }
          
          if (transaction) {
            console.log(`\n📋 Transaction Details:`);
            console.log(`   ID: ${transaction.id}`);
            console.log(`   Status: ${transaction.status}`);
            console.log(`   Chat Messages: ${transaction.chatMessages.length}`);
            
            // Get chat messages from Bybit
            console.log(`\n📨 Fetching chat messages from Bybit...`);
            const chatMessages = await client.getChatMessages(orderDetails.id, 1, 50);
            console.log(`   Total messages: ${chatMessages.list?.length || 0}`);
            
            if (chatMessages.list && chatMessages.list.length > 0) {
              console.log(`\n💬 Chat Messages:`);
              for (const msg of chatMessages.list) {
                const time = msg.createDate ? new Date(parseInt(msg.createDate)).toLocaleTimeString() : 'Unknown';
                const sender = msg.userId === orderDetails.userId ? 'US' : 'THEM';
                console.log(`   [${time}] ${sender}: ${msg.message || 'No content'}`);
              }
            }
            
            // Start automation if needed
            const hasOurMessages = transaction.chatMessages.some(msg => msg.sender === 'us');
            
            if (!hasOurMessages && (orderDetails.status === 10 || orderDetails.status === 20)) {
              console.log(`\n🤖 No messages from us detected. Starting automation...`);
              
              // Start chat automation
              await chatService.startAutomation(transaction.id);
              console.log(`   ✅ First message sent`);
              
              // Start chat polling
              await bybitManager.startChatPolling(transaction.id);
              console.log(`   ✅ Chat polling started`);
              
              // Send test message
              const testMessage = `Автоматический чат активирован. Order ID: ${orderId}`;
              await bybitManager.sendChatMessage(transaction.id, testMessage);
              console.log(`   ✅ Test message sent`);
            }
            
          } else {
            console.log(`\n❌ No transaction found in database for this order`);
          }
          
          break; // Found the order, no need to check other accounts
        }
      } catch (error: any) {
        if (error.message?.includes('Order does not exist')) {
          console.log(`   Order not found on this account`);
        } else {
          console.error(`   Error:`, error.message || error);
        }
      }
    }

    if (!orderFound) {
      console.log('\n❌ Order not found in any account');
      console.log('Please make sure:');
      console.log('1. The order ID is correct');
      console.log('2. The order belongs to one of your configured Bybit accounts');
      console.log('3. The order is not too old (deleted from Bybit)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);