import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function fixChatSending() {
  console.log('🔧 Fixing chat sending for transaction\n');
  
  try {
    // Найдем транзакцию
    const transaction = await prisma.transaction.findUnique({
      where: { id: 'cmc3ovhoxgnxa65aikqi' },
      include: {
        payout: true,
        advertisement: {
          include: {
            bybitAccount: true
          }
        }
      }
    });
    
    if (!transaction) {
      console.log('❌ Transaction not found');
      return;
    }
    
    console.log('📋 Transaction details:');
    console.log(`   ID: ${transaction.id}`);
    console.log(`   Order ID: ${transaction.orderId}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Chat Step: ${transaction.chatStep}`);
    
    // Обновим данные payout чтобы были реквизиты
    if (transaction.payout) {
      const updatedPayout = await prisma.payout.update({
        where: { id: transaction.payout.id },
        data: {
          amount: 2500,
          recipientCard: '2200000000000000',
          recipientName: 'ИВАН ИВАНОВ',
          bank: {
            name: 'Т-Банк'
          },
          trader: {
            phone: '+79001234567'
          },
          wallet: '2200000000000000',
          meta: {
            receiptEmail: 'test@example.com'
          }
        }
      });
      
      console.log('\n✅ Updated payout with payment details');
    }
    
    // Сбросим chatStep
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        chatStep: 1
      }
    });
    
    // Найдем последнее сообщение "да"
    const lastMessage = await prisma.chatMessage.findFirst({
      where: {
        transactionId: transaction.id,
        content: 'да'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (lastMessage) {
      await prisma.chatMessage.update({
        where: { id: lastMessage.id },
        data: { isProcessed: false }
      });
      console.log('✅ Marked "да" message as unprocessed');
    }
    
    // Пропустим настройку MailSlurp
    console.log('\n🔄 The chat processor should now:');
    console.log('   1. Process the "да" message');
    console.log('   2. Send payment details to Bybit chat');
    console.log('   3. Update chatStep to 999');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixChatSending();