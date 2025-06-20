import { getReceiptPayoutLinker } from './src/services/receiptPayoutLinkerService';
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function forceLinkReceipts() {
  try {
    console.log('\n🔄 Force linking unlinked receipts:');
    
    // Get unlinked receipts
    const unlinkedReceipts = await prisma.receipt.findMany({
      where: {
        isParsed: true,
        payoutId: null,
        amount: { not: null },
        parseError: null
      }
    });
    
    console.log(`Found ${unlinkedReceipts.length} unlinked receipts`);
    
    // Run linker service
    const linker = getReceiptPayoutLinker();
    const stats = await linker.linkUnlinkedReceipts();
    
    console.log('\n📊 Linking results:');
    console.log(`- Total processed: ${stats.total}`);
    console.log(`- Successfully linked: ${stats.linked}`);
    console.log(`- Failed: ${stats.failed}`);
    console.log(`- Skipped: ${stats.skipped}`);
    
    // Check status of transactions that were linked
    const recentlyLinked = await prisma.receipt.findMany({
      where: {
        payoutId: { not: null },
        updatedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        payout: {
          include: {
            transaction: true
          }
        }
      }
    });
    
    console.log(`\n✅ Recently linked receipts: ${recentlyLinked.length}`);
    
    for (const receipt of recentlyLinked) {
      const transaction = (receipt.payout as any)?.transaction;
      console.log(`\n- Receipt ${receipt.id}:`);
      console.log(`  Amount: ${receipt.amount} RUB`);
      console.log(`  Payout: ${receipt.payoutId}`);
      console.log(`  Transaction: ${transaction?.id || 'N/A'}`);
      console.log(`  Transaction status: ${transaction?.status || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

forceLinkReceipts();