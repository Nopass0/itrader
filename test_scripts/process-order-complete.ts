#!/usr/bin/env bun
import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';
import { TimeSync } from './src/bybit/utils/timeSync';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Processing active order and starting chat automation...\n');

  try {
    // Force time sync
    console.log('🕐 Synchronizing time...');
    await TimeSync.forceSync(false);
    console.log(`Time offset: ${TimeSync.getOffset()}ms\n`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    // Find transaction with order ID
    const transaction = await prisma.transaction.findFirst({
      where: { 
        orderId: { not: null }
      },
      include: { 
        chatMessages: true,
        advertisement: true,
        payout: true
      }
    });
    
    if (!transaction || !transaction.orderId) {
      console.log('No transaction with order ID found');
      return;
    }
    
    console.log(`Found transaction: ${transaction.id}`);
    console.log(`Order ID: ${transaction.orderId}`);
    console.log(`Status: ${transaction.status}\n`);
    
    const accountId = transaction.advertisement.bybitAccountId;
    const client = bybitManager.getClient(accountId);
    const httpClient = (client as any).httpClient;
    
    // Get order details
    console.log('📋 Getting order details...');
    const orderInfo = await httpClient.post('/v5/p2p/order/info', {
      orderId: transaction.orderId
    });
    
    if (orderInfo.result) {
      console.log(`✅ Order found!`);
      console.log(`Status: ${orderInfo.result.status}`);
      console.log(`Amount: ${orderInfo.result.amount} ${orderInfo.result.currencyId}`);
      console.log(`Counter party: ${orderInfo.result.targetNickName}`);
      console.log(`Counter party ID: ${orderInfo.result.targetUserId}`);
      
      // Update transaction status based on order status
      if (orderInfo.result.status === 10) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'waiting_payment' }
        });
      } else if (orderInfo.result.status === 20) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'payment_received' }
        });
      }
    }
    
    // Get and sync chat messages
    console.log('\n💬 Syncing chat messages...');
    const chatResponse = await httpClient.post('/v5/p2p/order/message/listpage', {
      orderId: transaction.orderId,
      size: "50"
    });
    
    if (chatResponse.result?.result && Array.isArray(chatResponse.result.result)) {
      console.log(`Found ${chatResponse.result.result.length} messages`);
      
      // Sync messages to database
      for (const msg of chatResponse.result.result) {
        if (!msg.message) continue;
        
        // Check if message exists
        const exists = await prisma.chatMessage.findFirst({
          where: {
            transactionId: transaction.id,
            messageId: msg.id
          }
        });
        
        if (!exists) {
          // Determine sender based on userId
          const sender = msg.userId === orderInfo.result.userId ? 'us' : 'counterparty';
          
          await prisma.chatMessage.create({
            data: {
              transactionId: transaction.id,
              messageId: msg.id,
              sender: sender,
              content: msg.message,
              messageType: msg.contentType === 'str' ? 'TEXT' : msg.contentType?.toUpperCase() || 'TEXT',
              isProcessed: sender === 'us'
            }
          });
          
          console.log(`💾 Saved message: [${sender}] ${msg.message.substring(0, 50)}...`);
        }
      }
    }
    
    // Start chat polling
    console.log('\n🔄 Starting chat polling...');
    await bybitManager.startChatPolling(transaction.id);
    console.log('✅ Chat polling active');
    
    // Check if we need to send first message
    const messages = await prisma.chatMessage.findMany({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: 'asc' }
    });
    
    const hasOurMessages = messages.some(msg => msg.sender === 'us');
    const hasCounterpartyMessages = messages.some(msg => msg.sender === 'counterparty');
    
    if (!hasOurMessages && !hasCounterpartyMessages) {
      console.log('\n🤖 No messages yet, starting chat automation...');
      await chatService.startAutomation(transaction.id);
    } else if (hasCounterpartyMessages) {
      // Process unprocessed messages
      const unprocessed = messages.filter(msg => 
        msg.sender === 'counterparty' && !msg.isProcessed
      );
      
      if (unprocessed.length > 0) {
        console.log(`\n🔄 Processing ${unprocessed.length} unprocessed messages...`);
        await chatService.processUnprocessedMessages();
      }
    }
    
    // Monitor continuously
    console.log('\n\n⏳ Starting continuous monitoring...');
    console.log('Press Ctrl+C to stop\n');
    
    // Process loop
    while (true) {
      // Check for new messages and process them
      await chatService.processUnprocessedMessages();
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);