import { db } from './src/db/index';
const prisma = db.prisma;

async function checkActiveTransactionsChat() {
  try {
    console.log('Checking active transactions and their chat status...\n');
    
    // Get active transactions
    const activeTransactions = await prisma.transaction.findMany({
      where: {
        status: {
          in: ['pending', 'chat_started', 'waiting_payment', 'payment_received']
        }
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'desc' }
        },
        advertisement: {
          include: {
            bybitAccount: true
          }
        },
        payout: true
      }
    });
    
    console.log(`Found ${activeTransactions.length} active transactions\n`);
    
    for (const transaction of activeTransactions) {
      console.log(`=== Transaction: ${transaction.id} ===`);
      console.log(`Order ID: ${transaction.orderId || 'N/A'}`);
      console.log(`Status: ${transaction.status}`);
      console.log(`Chat Step: ${transaction.chatStep}`);
      console.log(`Created: ${transaction.createdAt.toISOString()}`);
      console.log(`Updated: ${transaction.updatedAt.toISOString()}`);
      
      if (transaction.payout) {
        console.log(`\nPayout Info:`);
        console.log(`  Wallet: ${transaction.payout.wallet}`);
        console.log(`  Status: ${transaction.payout.status}`);
      }
      
      if (transaction.advertisement) {
        console.log(`\nAdvertisement:`);
        console.log(`  Bybit Ad ID: ${transaction.advertisement.bybitAdId}`);
        console.log(`  Bybit Account: ${transaction.advertisement.bybitAccountId}`);
      }
      
      console.log(`\nChat Messages (${transaction.chatMessages.length} total):`);
      if (transaction.chatMessages.length === 0) {
        console.log('  No chat messages');
      } else {
        // Show last 5 messages
        const recentMessages = transaction.chatMessages.slice(0, 5);
        recentMessages.forEach(msg => {
          console.log(`  [${msg.createdAt.toISOString()}] ${msg.sender}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
          console.log(`    Processed: ${msg.isProcessed}, Type: ${msg.messageType}`);
        });
        
        // Count unprocessed
        const unprocessedCount = transaction.chatMessages.filter(m => !m.isProcessed).length;
        if (unprocessedCount > 0) {
          console.log(`  ⚠️  ${unprocessedCount} unprocessed messages!`);
        }
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
    // Check for transactions that should have messages sent
    console.log('=== TRANSACTIONS NEEDING ACTION ===');
    for (const transaction of activeTransactions) {
      const hasGreeting = transaction.chatMessages.some(m => 
        m.sender === 'me' && m.content.includes('Здравствуйте')
      );
      const hasPaymentDetails = transaction.chatMessages.some(m => 
        m.sender === 'me' && (m.content.includes('Тинькофф') || m.content.includes('банковский перевод'))
      );
      
      if (transaction.status === 'chat_started' && !hasGreeting) {
        console.log(`Transaction ${transaction.id} needs greeting message`);
      }
      if (transaction.status === 'waiting_payment' && !hasPaymentDetails && transaction.chatStep >= 1) {
        console.log(`Transaction ${transaction.id} needs payment details`);
      }
    }
    
    // Check recent ChatAutomation activity
    console.log('\n=== RECENT CHATAUTOMATION ACTIVITY ===');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentLogs = await prisma.systemLog.findMany({
      where: {
        service: 'ChatAutomation',
        timestamp: { gte: tenMinutesAgo },
        OR: [
          { message: { contains: 'Processing' } },
          { message: { contains: 'Sending' } },
          { message: { contains: 'sent' } }
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    
    if (recentLogs.length === 0) {
      console.log('No processing/sending activity in the last 10 minutes');
    } else {
      recentLogs.forEach(log => {
        console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActiveTransactionsChat();