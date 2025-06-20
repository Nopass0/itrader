import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function checkReceiptLinkingStatus() {
  try {
    console.log('\n🔍 Checking Receipt Linking Status:');
    
    // Check receipts with payoutId
    const linkedReceipts = await prisma.receipt.findMany({
      where: {
        payoutId: { not: null }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });
    
    console.log(`\n✅ Linked receipts (showing last 10):`);
    for (const receipt of linkedReceipts) {
      console.log(`\n- Receipt ${receipt.id}:`);
      console.log(`  Amount: ${receipt.amount} RUB`);
      console.log(`  Payout ID: ${receipt.payoutId}`);
      console.log(`  Updated: ${receipt.updatedAt}`);
      
      // Check if payoutId is valid DB ID (starts with 'cmc')
      if (receipt.payoutId?.startsWith('cmc')) {
        // This is a DB ID, let's get the payout
        const payout = await prisma.payout.findUnique({
          where: { id: receipt.payoutId },
          include: { transaction: true }
        });
        
        if (payout) {
          console.log(`  ✅ Payout details:`);
          console.log(`     Gate ID: ${payout.gatePayoutId}`);
          console.log(`     Status: ${payout.status}`);
          console.log(`     Has transaction: ${!!payout.transaction}`);
          if (payout.transaction) {
            console.log(`     Transaction status: ${payout.transaction.status}`);
          }
        } else {
          console.log(`  ❌ Payout not found in DB`);
        }
      } else {
        console.log(`  ⚠️ PayoutId is Gate ID (${receipt.payoutId}), should be DB ID`);
      }
    }
    
    // Check unlinked receipts
    const unlinkedReceipts = await prisma.receipt.findMany({
      where: {
        isParsed: true,
        payoutId: null,
        amount: { not: null },
        parseError: null
      }
    });
    
    console.log(`\n❌ Unlinked receipts: ${unlinkedReceipts.length}`);
    for (const receipt of unlinkedReceipts) {
      console.log(`- ${receipt.id}: ${receipt.amount} RUB, ${receipt.recipientPhone || receipt.recipientCard || 'no contact'}`);
    }
    
    // Check for matching payouts
    if (unlinkedReceipts.length > 0) {
      console.log('\n🔍 Looking for matching payouts:');
      
      for (const receipt of unlinkedReceipts) {
        const possiblePayouts = await prisma.payout.findMany({
          where: {
            OR: [
              { amount: receipt.amount },
              { 
                amountTrader: {
                  path: '$.643',
                  equals: receipt.amount
                }
              }
            ]
          },
          take: 3
        });
        
        if (possiblePayouts.length > 0) {
          console.log(`\n  Receipt ${receipt.id} (${receipt.amount} RUB) could match:`);
          for (const p of possiblePayouts) {
            console.log(`  - Payout ${p.id} (Gate: ${p.gatePayoutId}), wallet: ${p.wallet}`);
          }
        }
      }
    }
    
    // Check transactions with release_money status
    const releaseMoneyTransactions = await prisma.transaction.findMany({
      where: {
        status: 'release_money'
      },
      include: {
        payout: true
      }
    });
    
    console.log(`\n⏳ Transactions in release_money status: ${releaseMoneyTransactions.length}`);
    for (const tx of releaseMoneyTransactions) {
      console.log(`- Transaction ${tx.id}: approved at ${tx.approvedAt || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReceiptLinkingStatus();