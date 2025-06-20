import { db } from './src/db';

async function checkRecentMessages() {
  console.log('🔍 Checking recent messages...\n');
  
  // Get most recent transaction with messages
  const recentTx = await db.prisma.transaction.findFirst({
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
      chatMessages: {
        where: { sender: 'me' },
        orderBy: { createdAt: 'asc' }
      },
      advertisement: true
    }
  });
  
  if (!recentTx) {
    console.log('No recent transactions with old format messages');
    return;
  }
  
  console.log(`Transaction: ${recentTx.id}`);
  console.log(`Created: ${recentTx.createdAt}`);
  console.log(`Status: ${recentTx.status}`);
  console.log(`Chat step: ${recentTx.chatStep}\n`);
  
  console.log('Messages from us:');
  recentTx.chatMessages.forEach((msg, i) => {
    console.log(`\n${i + 1}. ${msg.createdAt.toISOString()}`);
    console.log(`   ID: ${msg.id}`);
    console.log(`   Content: ${msg.content?.substring(0, 100)}...`);
  });
  
  // Check for messages sent today in new format
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const newFormatMessages = await db.prisma.chatMessage.findMany({
    where: {
      sender: 'me',
      createdAt: { gte: todayStart },
      OR: [
        { content: { contains: 'Сумма:' } },
        { content: { contains: '⚠️ ФИО не спрашивать' } }
      ]
    },
    include: {
      transaction: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log(`\n\nNew format messages sent today: ${newFormatMessages.length}`);
  
  if (newFormatMessages.length > 0) {
    // Group by transaction
    const byTx = new Map<string, any[]>();
    newFormatMessages.forEach(msg => {
      const txId = msg.transactionId;
      if (!byTx.has(txId)) {
        byTx.set(txId, []);
      }
      byTx.get(txId)!.push(msg);
    });
    
    console.log(`Found in ${byTx.size} transactions\n`);
    
    for (const [txId, msgs] of byTx) {
      console.log(`Transaction ${txId}:`);
      msgs.forEach(msg => {
        console.log(`  - ${msg.content}`);
      });
    }
  }
}

checkRecentMessages()
  .catch(console.error)
  .finally(() => db.prisma.$disconnect());