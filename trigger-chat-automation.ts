import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function triggerChatAutomation() {
  console.log('🚀 Triggering chat automation for order 1935774322475847680\n');
  
  try {
    // Найдем транзакцию
    const transaction = await prisma.transaction.findFirst({
      where: { orderId: '1935774322475847680' },
      include: {
        chatMessages: true,
        payout: true
      }
    });
    
    if (!transaction) {
      console.log('❌ Transaction not found');
      return;
    }
    
    console.log('✅ Transaction found:', transaction.id);
    console.log('   Status:', transaction.status);
    console.log('   Chat Step:', transaction.chatStep);
    console.log('   Messages:', transaction.chatMessages.length);
    
    // Убедимся что есть данные payout
    if (transaction.payout) {
      if (!transaction.payout.wallet || !transaction.payout.recipientCard) {
        console.log('\n⚠️  Updating payout with payment details...');
        
        await prisma.payout.update({
          where: { id: transaction.payout.id },
          data: {
            amount: 3226,
            wallet: '2200000000000000',
            recipientCard: '2200000000000000',
            recipientName: 'ИВАН ИВАНОВ',
            bank: {
              label: 'Т-Банк',
              name: 'Т-Банк'
            },
            trader: {
              phone: '+79001234567'
            }
          }
        });
        
        console.log('✅ Payout updated with payment details');
      }
    }
    
    if (transaction.chatStep === 0) {
      console.log('\n📨 Creating buyer message to trigger automation...');
      
      // Создадим сообщение от покупателя
      await prisma.chatMessage.create({
        data: {
          transactionId: transaction.id,
          messageId: `buyer_${Date.now()}`,
          content: 'Привет',
          message: 'Привет',
          sender: 'buyer',
          messageType: 'TEXT',
          isProcessed: false
        }
      });
      
      console.log('✅ Created unprocessed message from buyer');
      console.log('\n⏳ Chat processor should pick this up and start automation');
      
    } else if (transaction.chatStep === 1) {
      console.log('\n📨 Creating "да" message to trigger payment details...');
      
      // Создадим сообщение "да"
      await prisma.chatMessage.create({
        data: {
          transactionId: transaction.id,
          messageId: `buyer_yes_${Date.now()}`,
          content: 'да',
          message: 'да',
          sender: 'buyer',
          messageType: 'TEXT',
          isProcessed: false
        }
      });
      
      console.log('✅ Created "да" message from buyer');
      console.log('\n⏳ Chat processor should send payment details now');
      
    } else {
      console.log('\n✅ Chat step:', transaction.chatStep);
      console.log('   Automation already in progress');
    }
    
    console.log('\n📊 Watch the application logs for:');
    console.log('   - "🔍 Checking for unprocessed messages"');
    console.log('   - "📨 Found unprocessed messages"');
    console.log('   - "🚀 Attempting to start automation"');
    console.log('   - "📤 Sending initial message"');
    console.log('   - "💳 Preparing to send payment details"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

triggerChatAutomation();