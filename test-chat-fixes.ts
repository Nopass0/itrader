import { db } from './src/db';

async function testChatFixes() {
  console.log('🔍 Checking for duplicate messages...\n');
  
  // Get all chat messages grouped by transaction
  const messages = await db.prisma.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      transaction: true
    }
  });
  
  // Group by transaction and check for duplicates
  const messagesByTransaction = new Map<string, any[]>();
  
  messages.forEach(msg => {
    const txId = msg.transactionId;
    if (!messagesByTransaction.has(txId)) {
      messagesByTransaction.set(txId, []);
    }
    messagesByTransaction.get(txId)!.push(msg);
  });
  
  console.log(`Found ${messagesByTransaction.size} transactions with messages\n`);
  
  // Check each transaction for duplicate messages
  for (const [txId, msgs] of messagesByTransaction) {
    // Find duplicate messages (same content within 10 seconds)
    const duplicates = new Map<string, any[]>();
    
    msgs.forEach(msg => {
      if (msg.sender === 'me') {
        const key = msg.content?.substring(0, 50) || msg.message?.substring(0, 50);
        if (!duplicates.has(key)) {
          duplicates.set(key, []);
        }
        duplicates.get(key)!.push(msg);
      }
    });
    
    // Report duplicates
    for (const [content, dupMsgs] of duplicates) {
      if (dupMsgs.length > 1) {
        console.log(`\n❌ Transaction ${txId} has ${dupMsgs.length} duplicate messages:`);
        console.log(`   Content: "${content}..."`);
        dupMsgs.forEach(msg => {
          console.log(`   - ${msg.createdAt.toISOString()} (ID: ${msg.id})`);
        });
        
        // Check time difference
        const times = dupMsgs.map(m => m.createdAt.getTime()).sort();
        const timeDiff = (times[times.length - 1] - times[0]) / 1000;
        console.log(`   Time span: ${timeDiff} seconds`);
      }
    }
  }
  
  // Check active advertisements for duplicates
  console.log('\n\n🔍 Checking for duplicate advertisements...\n');
  
  const activeAds = await db.prisma.advertisement.findMany({
    where: { isActive: true },
    include: {
      transaction: true,
      bybitAccount: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Group by payout
  const adsByPayout = new Map<string, any[]>();
  
  activeAds.forEach(ad => {
    if (ad.transaction?.payoutId) {
      const payoutId = ad.transaction.payoutId;
      if (!adsByPayout.has(payoutId)) {
        adsByPayout.set(payoutId, []);
      }
      adsByPayout.get(payoutId)!.push(ad);
    }
  });
  
  // Report duplicate ads
  for (const [payoutId, ads] of adsByPayout) {
    if (ads.length > 1) {
      console.log(`\n❌ Payout ${payoutId} has ${ads.length} active advertisements:`);
      ads.forEach(ad => {
        console.log(`   - Ad ${ad.id} on account ${ad.bybitAccount?.accountId} (created: ${ad.createdAt.toISOString()})`);
      });
    }
  }
  
  // Check recent transactions
  console.log('\n\n📊 Recent transactions summary:\n');
  
  const recentTxs = await db.prisma.transaction.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      advertisement: true,
      chatMessages: {
        where: { sender: 'me' }
      }
    }
  });
  
  recentTxs.forEach(tx => {
    console.log(`Transaction ${tx.id}:`);
    console.log(`  Status: ${tx.status}`);
    console.log(`  Chat step: ${tx.chatStep}`);
    console.log(`  Messages sent: ${tx.chatMessages.length}`);
    console.log(`  Advertisement: ${tx.advertisement?.bybitAdId || 'none'}`);
    console.log('');
  });
}

testChatFixes()
  .catch(console.error)
  .finally(() => db.prisma.$disconnect());