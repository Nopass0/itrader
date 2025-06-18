#!/usr/bin/env bun

/**
 * Find all orders from Bybit and process them
 */

import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { P2POrderProcessor } from './src/services/p2pOrderProcessor';
import { ChatAutomationService } from './src/services/chatAutomation';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding and processing orders from Bybit...\n');

  try {
    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    const orderProcessor = new P2POrderProcessor(bybitManager, chatService);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    let totalOrdersFound = 0;
    let ordersToProcess = [];

    for (const account of accounts) {
      console.log(`\n📋 Account: ${account.accountId}`);
      console.log('=' .repeat(50));
      
      try {
        const client = bybitManager.getClient(account.accountId);
        
        // Get pending orders using simplifyList endpoint
        console.log('\n🔄 Fetching pending orders...');
        const pendingOrders = await client.getPendingOrders(1, 50);
        
        console.log(`Found ${pendingOrders.list?.length || 0} pending orders`);
        
        if (pendingOrders.list && pendingOrders.list.length > 0) {
          for (const order of pendingOrders.list) {
            totalOrdersFound++;
            console.log(`\n   ✅ Order ID: ${order.id}`);
            console.log(`   Status: ${order.status}`);
            console.log(`   Amount: ${order.amount} ${order.currencyId}`);
            console.log(`   Price: ${order.price}`);
            console.log(`   Counterparty: ${order.targetNickName || 'Unknown'}`);
            console.log(`   Created: ${order.createDate ? new Date(parseInt(order.createDate)).toLocaleString() : 'Unknown'}`);
            
            // Check if we have this order in DB
            const existingTransaction = await prisma.transaction.findFirst({
              where: { orderId: order.id },
              include: { 
                chatMessages: true,
                advertisement: true 
              }
            });
            
            if (existingTransaction) {
              console.log(`   📊 Found in DB: Transaction ${existingTransaction.id}`);
              console.log(`   📬 Chat messages: ${existingTransaction.chatMessages.length}`);
              
              // Check if we need to initiate chat
              const hasOurMessages = existingTransaction.chatMessages.some(msg => msg.sender === 'us');
              if (!hasOurMessages) {
                console.log(`   ⚠️ No messages from us! Need to initiate chat.`);
                ordersToProcess.push({
                  order,
                  transaction: existingTransaction,
                  accountId: account.accountId
                });
              }
            } else {
              console.log(`   ❌ NOT IN DB! Need to create transaction.`);
              
              // Try to get order details to find the advertisement
              try {
                const orderDetails = await client.getOrderDetails(order.id);
                console.log(`   📝 Order details: itemId=${orderDetails.itemId}`);
                
                // Find advertisement by Bybit ID
                const advertisement = await prisma.bybitAdvertisement.findFirst({
                  where: { bybitAdId: orderDetails.itemId }
                });
                
                if (advertisement) {
                  console.log(`   📢 Found advertisement: ${advertisement.id}`);
                  
                  // Find transaction by advertisement
                  const transaction = await prisma.transaction.findFirst({
                    where: { advertisementId: advertisement.id }
                  });
                  
                  if (transaction) {
                    console.log(`   🔗 Found transaction by advertisement: ${transaction.id}`);
                    
                    // Update transaction with order ID
                    await prisma.transaction.update({
                      where: { id: transaction.id },
                      data: { 
                        orderId: order.id,
                        status: 'chat_started'
                      }
                    });
                    
                    ordersToProcess.push({
                      order,
                      transaction,
                      accountId: account.accountId
                    });
                  } else {
                    console.log(`   ⚠️ No transaction found for this advertisement`);
                  }
                } else {
                  console.log(`   ⚠️ Advertisement not found for itemId: ${orderDetails.itemId}`);
                }
              } catch (error) {
                console.error(`   ❌ Error getting order details:`, error);
              }
            }
          }
        }
        
      } catch (error) {
        console.error(`Error checking account ${account.accountId}:`, error);
      }
    }

    // Process orders that need attention
    if (ordersToProcess.length > 0) {
      console.log(`\n\n🚀 Processing ${ordersToProcess.length} orders...\n`);
      
      for (const { order, transaction, accountId } of ordersToProcess) {
        console.log(`\n📝 Processing order ${order.id} (Transaction: ${transaction.id})`);
        
        try {
          // Start chat automation
          await chatService.startAutomation(transaction.id);
          console.log(`   ✅ Chat automation started`);
          
          // Start chat polling
          await bybitManager.startChatPolling(transaction.id);
          console.log(`   ✅ Chat polling started`);
          
          // Wait a bit for the message to be sent
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check messages
          const messages = await prisma.chatMessage.findMany({
            where: { transactionId: transaction.id },
            orderBy: { createdAt: 'asc' }
          });
          
          console.log(`   📬 Total messages now: ${messages.length}`);
          if (messages.length > 0) {
            const latestMessage = messages[messages.length - 1];
            console.log(`   💬 Latest: [${latestMessage.sender}] ${latestMessage.content.substring(0, 50)}...`);
          }
          
        } catch (error) {
          console.error(`   ❌ Error processing order:`, error);
        }
      }
    } else {
      console.log('\n✅ All orders are properly set up!');
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total orders found: ${totalOrdersFound}`);
    console.log(`   Orders processed: ${ordersToProcess.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);