import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkDatabaseData() {
  try {
    console.log('Checking database for existing data...\n');

    // Check Transactions
    console.log('=== TRANSACTIONS ===');
    const transactionCount = await prisma.transaction.count();
    console.log(`Total transactions: ${transactionCount}`);
    
    if (transactionCount > 0) {
      const transactions = await prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          advertisement: true,
          chatMessages: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      
      console.log('\nRecent transactions:');
      for (const tx of transactions) {
        console.log(`\n- ID: ${tx.id}`);
        console.log(`  Order ID: ${tx.orderId || 'N/A'}`);
        console.log(`  Status: ${tx.status}`);
        console.log(`  Amount: ${tx.amount}`);
        console.log(`  Counterparty: ${tx.counterpartyName || 'N/A'}`);
        console.log(`  Advertisement: ${tx.advertisement.bybitAdId || tx.advertisement.id}`);
        console.log(`  Chat messages: ${tx.chatMessages.length}`);
        console.log(`  Created: ${tx.createdAt}`);
      }
    }

    // Check Chat Messages
    console.log('\n\n=== CHAT MESSAGES ===');
    const chatMessageCount = await prisma.chatMessage.count();
    console.log(`Total chat messages: ${chatMessageCount}`);
    
    if (chatMessageCount > 0) {
      const chatMessages = await prisma.chatMessage.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: true
        }
      });
      
      console.log('\nRecent chat messages:');
      for (const msg of chatMessages) {
        console.log(`\n- ID: ${msg.id}`);
        console.log(`  Transaction: ${msg.transaction.orderId || msg.transactionId}`);
        console.log(`  Sender: ${msg.sender}`);
        console.log(`  Message: ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`);
        console.log(`  Type: ${msg.messageType}`);
        console.log(`  Auto-reply: ${msg.isAutoReply}`);
        console.log(`  Processed: ${msg.isProcessed}`);
        console.log(`  Created: ${msg.createdAt}`);
      }
    }

    // Check other related data
    console.log('\n\n=== OTHER DATA ===');
    const bybitAccountCount = await prisma.bybitAccount.count();
    const advertisementCount = await prisma.advertisement.count();
    const payoutCount = await prisma.payout.count();
    const gateAccountCount = await prisma.gateAccount.count();
    
    console.log(`Bybit accounts: ${bybitAccountCount}`);
    console.log(`Advertisements: ${advertisementCount}`);
    console.log(`Payouts: ${payoutCount}`);
    console.log(`Gate accounts: ${gateAccountCount}`);

    // Check status breakdown for transactions
    if (transactionCount > 0) {
      console.log('\n\n=== TRANSACTION STATUS BREAKDOWN ===');
      const statusCounts = await prisma.transaction.groupBy({
        by: ['status'],
        _count: true
      });
      
      for (const status of statusCounts) {
        console.log(`${status.status}: ${status._count}`);
      }
    }

    // Check recent automation logs
    console.log('\n\n=== RECENT AUTOMATION LOGS ===');
    const recentLogs = await prisma.automationLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    if (recentLogs.length > 0) {
      for (const log of recentLogs) {
        console.log(`\n[${log.level.toUpperCase()}] ${log.module} - ${log.message}`);
        console.log(`  Time: ${log.createdAt}`);
        if (log.metadata) {
          console.log(`  Metadata: ${log.metadata}`);
        }
      }
    } else {
      console.log('No automation logs found');
    }

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseData();