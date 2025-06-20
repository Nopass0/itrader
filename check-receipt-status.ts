import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function checkReceiptStatus() {
  try {
    // Check the specific receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id: 'cmc4s0gmw00ahiky3mdllxzar' }
    });
    
    if (receipt) {
      console.log('Receipt status:');
      console.log(`- ID: ${receipt.id}`);
      console.log(`- Amount: ${receipt.amount}`);
      console.log(`- Payout ID: ${receipt.payoutId || 'NOT LINKED'}`);
      console.log(`- Is Processed: ${receipt.isProcessed}`);
      console.log(`- Updated: ${receipt.updatedAt}`);
    }
    
    // Check all unlinked receipts again
    const unlinkedReceipts = await prisma.receipt.findMany({
      where: {
        isParsed: true,
        payoutId: null,
        amount: { not: null },
        parseError: null
      }
    });
    
    console.log(`\nTotal unlinked receipts: ${unlinkedReceipts.length}`);
    
    for (const r of unlinkedReceipts) {
      console.log(`\n- ${r.id}: ${r.amount} RUB, ${r.recipientPhone || r.recipientCard || 'no phone/card'}`);
    }
    
    // Check recent linked receipts
    const recentlyLinked = await prisma.receipt.findMany({
      where: {
        payoutId: { not: null },
        updatedAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    console.log(`\n✅ Recently linked receipts (last 10 min): ${recentlyLinked.length}`);
    for (const r of recentlyLinked) {
      console.log(`- ${r.id}: linked to payout ${r.payoutId} at ${r.updatedAt}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReceiptStatus();