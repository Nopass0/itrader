import { ChatAutomationService } from './src/services/chatAutomation';
import { BybitP2PManagerService } from './src/services/bybitP2PManager';
import { db } from './src/db';

async function debugPaymentFormat() {
  console.log('🔍 Debugging payment format issue...\n');
  
  // Get a recent transaction with old format payment details
  const transaction = await db.prisma.transaction.findFirst({
    where: {
      chatMessages: {
        some: {
          sender: 'me',
          content: { contains: 'Реквизиты для оплаты' }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      advertisement: {
        include: {
          bybitAccount: true,
          payout: true
        }
      },
      payout: true,
      chatMessages: {
        where: { sender: 'me' },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  
  if (!transaction) {
    console.log('No transactions found with old format');
    return;
  }
  
  console.log('Transaction:', transaction.id);
  console.log('Created:', transaction.createdAt);
  console.log('Chat step:', transaction.chatStep);
  console.log('Advertisement:', transaction.advertisement?.id);
  console.log('Payout:', transaction.payoutId);
  
  // Check the payment method
  console.log('\nPayment method:', transaction.advertisement?.paymentMethod);
  console.log('Bybit account:', transaction.advertisement?.bybitAccount?.accountId);
  
  // Look at the messages
  console.log('\n📨 Messages sent:');
  transaction.chatMessages.forEach((msg, i) => {
    const preview = msg.content?.substring(0, 100).replace(/\n/g, ' ');
    console.log(`${i + 1}. ${msg.createdAt.toISOString()} - ${preview}...`);
  });
  
  // Check the code path
  console.log('\n🔍 Checking code logic...');
  
  // Create chat service instance
  const bybitManager = new BybitP2PManagerService();
  const chatService = new ChatAutomationService(bybitManager);
  
  // Check the payment details format
  console.log('\nChecking ChatAutomationService...');
  console.log('- sendPaymentDetails method should send 5 separate messages');
  console.log('- The old format "Реквизиты для оплаты:" should not exist in code');
  
  // Look for any configuration or constants
  const configFiles = await db.prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%config%' OR table_name LIKE '%template%'
  `;
  
  console.log('\nConfig tables:', configFiles);
}

debugPaymentFormat()
  .catch(console.error)
  .finally(() => db.prisma.$disconnect());