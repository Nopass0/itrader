import { PrismaClient } from './generated/prisma';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { ChatAutomationService } from './src/services/chatAutomation';
import { TimeSync } from './src/bybit/utils/timeSync';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Processing orders with correct API endpoints...\n');

  try {
    // Force time sync
    console.log('🕐 Synchronizing time...');
    await TimeSync.forceSync(false);
    console.log(`Time offset: ${TimeSync.getOffset()}ms\n`);

    // Initialize services
    const bybitManager = new BybitP2PManagerService();
    await bybitManager.initialize();
    
    const chatService = new ChatAutomationService(bybitManager);
    
    const accounts = await bybitManager.getActiveAccounts();
    console.log(`Found ${accounts.length} active Bybit accounts\n`);

    // Process continuously
    while (true) {
      for (const account of accounts) {
        console.log(`\n📋 Checking account: ${account.accountId}`);
        
        try {
          const client = bybitManager.getClient(account.accountId);
          const httpClient = (client as any).httpClient;
          
          // 1. Get pending orders with correct endpoint
          console.log('\n🔄 Getting pending orders...');
          const pendingResponse = await httpClient.post('/v5/p2p/order/pending/simplifyList', {
            status: null,
            beginTime: null,
            endTime: null,
            tokenId: null,
            side: null,
            page: 1,
            size: 50
          });
          
          console.log(`Pending orders count: ${pendingResponse.result?.count || 0}`);
          
          if (pendingResponse.result?.items && pendingResponse.result.items.length > 0) {
            console.log(`Found ${pendingResponse.result.items.length} pending orders!`);
            
            for (const order of pendingResponse.result.items) {
              await processOrder(order, account.accountId, bybitManager, chatService, httpClient);
            }
          }
          
          // 2. Get all orders with status filter
          console.log('\n🔄 Getting all orders...');
          const allOrdersResponse = await httpClient.post('/v5/p2p/order/simplifyList', {
            status: null,
            beginTime: null,
            endTime: null,
            tokenId: null,
            side: null,
            page: 1,
            size: 50
          });
          
          console.log(`All orders count: ${allOrdersResponse.result?.count || 0}`);
          
          if (allOrdersResponse.result?.items && allOrdersResponse.result.items.length > 0) {
            // Filter active orders (status 10 or 20)
            const activeOrders = allOrdersResponse.result.items.filter((order: any) => 
              order.status === 10 || order.status === 20
            );
            
            console.log(`Found ${activeOrders.length} active orders!`);
            
            for (const order of activeOrders) {
              await processOrder(order, account.accountId, bybitManager, chatService, httpClient);
            }
          }
          
        } catch (error: any) {
          console.error(`Error checking account:`, error.message);
          
          // Re-sync time if needed
          if (error.message?.includes('timestamp')) {
            await TimeSync.forceSync(false);
          }
        }
      }
      
      // Process unprocessed messages
      await chatService.processUnprocessedMessages();
      
      console.log('\n⏳ Waiting 30 seconds before next check...');
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
  chatService: ChatAutomationService,
  httpClient: any
) {
  console.log(`\n📝 Processing order ${order.id}`);
  console.log(`   Status: ${order.status}`);
  console.log(`   Amount: ${order.amount} ${order.currencyId}`);
  console.log(`   Side: ${order.side === 0 ? 'BUY' : 'SELL'}`);
  
  try {
    // Get full order details
    const orderDetailsResponse = await httpClient.post('/v5/p2p/order/info', {
      orderId: order.id
    });
    
    if (!orderDetailsResponse.result) {
      console.log(`   ❌ Failed to get order details`);
      return;
    }
    
    const orderDetails = orderDetailsResponse.result;
    console.log(`   Item ID: ${orderDetails.itemId}`);
    console.log(`   Counterparty: ${orderDetails.targetNickName}`);
    
    // Find or link transaction
    let transaction = await prisma.transaction.findFirst({
      where: { orderId: order.id },
      include: { 
        chatMessages: true,
        advertisement: true,
        payout: true
      }
    });
    
    if (!transaction) {
      // Try to find by advertisement
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
          console.log(`   ✅ Linked order to transaction ${transaction.id}`);
        }
      }
    }
    
    if (!transaction) {
      console.log(`   ❌ No transaction found for this order`);
      return;
    }
    
    // Get chat messages
    console.log('\n   📨 Getting chat messages...');
    const chatResponse = await httpClient.post('/v5/p2p/order/message/listpage', {
      orderId: order.id,
      size: "50"
    });
    
    if (chatResponse.result && Array.isArray(chatResponse.result)) {
      console.log(`   Found ${chatResponse.result.length} chat messages`);
      
      // Sync messages to database
      for (const msg of chatResponse.result) {
        if (!msg.message) continue;
        
        // Check if message exists
        const exists = await prisma.chatMessage.findFirst({
          where: {
            transactionId: transaction.id,
            messageId: msg.id
          }
        });
        
        if (!exists) {
          // Determine sender
          const sender = msg.userId === orderDetails.userId ? 'us' : 'counterparty';
          
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
          
          console.log(`   💾 Saved message: [${sender}] ${msg.message.substring(0, 50)}...`);
        }
      }
    }
    
    // Check if we need to send first message
    const hasOurMessages = transaction.chatMessages.some(msg => msg.sender === 'us');
    if (!hasOurMessages) {
      console.log(`   🤖 No messages from us, starting chat automation...`);
      await chatService.startAutomation(transaction.id);
    }
    
    // Ensure chat polling
    await bybitManager.startChatPolling(transaction.id);
    console.log(`   ✅ Chat polling active`);
    
    // Process unprocessed messages
    const unprocessed = transaction.chatMessages.filter(msg => 
      msg.sender === 'counterparty' && !msg.isProcessed
    );
    
    if (unprocessed.length > 0) {
      console.log(`   🔄 Processing ${unprocessed.length} unprocessed messages...`);
      await chatService.processUnprocessedMessages();
    }
    
  } catch (error) {
    console.error(`   ❌ Error processing order:`, error);
  }
}

main().catch(console.error);