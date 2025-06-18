#!/usr/bin/env bun
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { TimeSync } from './src/bybit/utils/timeSync';
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const orderId = '1932153795647381504';
  console.log(`🔍 Getting details for order: ${orderId}\n`);

  try {
    // Force time sync
    await TimeSync.forceSync(false);
    console.log(`Time offset: ${TimeSync.getOffset()}ms\n`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const accounts = await bybitManager.getActiveAccounts();
    if (accounts.length === 0) {
      console.log('No active accounts found');
      return;
    }

    const account = accounts[0];
    console.log(`Using account: ${account.accountId}\n`);
    
    const client = bybitManager.getClient(account.accountId);
    const httpClient = (client as any).httpClient;
    
    // Test 1: Get order info
    console.log('📋 Getting order info...');
    try {
      const orderInfo = await httpClient.post('/v5/p2p/order/info', {
        orderId: orderId
      });
      
      console.log('Order Info:', JSON.stringify(orderInfo.result, null, 2));
      
      if (orderInfo.result) {
        console.log(`\n✅ Order found!`);
        console.log(`Status: ${orderInfo.result.status}`);
        console.log(`Amount: ${orderInfo.result.amount} ${orderInfo.result.currencyId}`);
        console.log(`Side: ${orderInfo.result.side === '0' ? 'BUY' : 'SELL'}`);
        console.log(`Counter party: ${orderInfo.result.targetNickName}`);
      }
    } catch (error: any) {
      console.error('Error getting order info:', error.message);
    }
    
    // Test 2: Get chat messages
    console.log('\n\n💬 Getting chat messages...');
    try {
      const chatMessages = await httpClient.post('/v5/p2p/order/message/listpage', {
        orderId: orderId,
        size: "50"
      });
      
      console.log('Chat response:', JSON.stringify(chatMessages.result, null, 2));
      
      if (chatMessages.result?.result && Array.isArray(chatMessages.result.result)) {
        console.log(`\nFound ${chatMessages.result.result.length} messages`);
        
        for (const msg of chatMessages.result.result) {
          console.log(`\n[${msg.created}] ${msg.userId}: ${msg.message}`);
        }
      }
    } catch (error: any) {
      console.error('Error getting chat messages:', error.message);
    }
    
    // Test 3: Send a test message
    console.log('\n\n📨 Sending test message...');
    try {
      const testMessage = `Тестовое сообщение ${new Date().toLocaleTimeString('ru-RU')}`;
      
      const sendResult = await httpClient.post('/v5/p2p/order/message/send', {
        orderId: orderId,
        message: testMessage,
        contentType: "str"
      });
      
      console.log('Send result:', JSON.stringify(sendResult.result, null, 2));
      
      if (sendResult.result) {
        console.log('✅ Message sent successfully!');
        
        // Save to database
        const transaction = await prisma.transaction.findFirst({
          where: { orderId: orderId }
        });
        
        if (transaction) {
          await prisma.chatMessage.create({
            data: {
              transactionId: transaction.id,
              messageId: sendResult.result.id || `test_${Date.now()}`,
              sender: 'us',
              content: testMessage,
              messageType: 'TEXT',
              isProcessed: true
            }
          });
          console.log('💾 Message saved to database');
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error.message);
      if (error.details) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);