import { PrismaClient } from './generated/prisma';
import { getReceiptPayoutLinker } from './src/services/receiptPayoutLinkerService';

const prisma = new PrismaClient();

async function testNewReceiptLinking() {
  try {
    console.log('\n🧪 Testing updated receipt linking flow:');
    
    // Find a payout with status 5 that doesn't have a receipt
    const availablePayout = await prisma.payout.findFirst({
      where: {
        status: 5,
        id: {
          notIn: await prisma.receipt.findMany({
            where: { payoutId: { not: null } },
            select: { payoutId: true }
          }).then(receipts => receipts.map(r => r.payoutId).filter(id => id !== null))
        }
      },
      include: {
        transaction: true
      }
    });
    
    if (!availablePayout) {
      console.log('No available payout for testing');
      return;
    }
    
    const amount = availablePayout.amountTrader && typeof availablePayout.amountTrader === 'object'
      ? (availablePayout.amountTrader as any)['643'] || availablePayout.amount  
      : availablePayout.amount;
    
    console.log(`\n📦 Found test payout:`);
    console.log(`- ID: ${availablePayout.gatePayoutId}`);
    console.log(`- Amount: ${amount} RUB`);
    console.log(`- Wallet: ${availablePayout.wallet}`);
    console.log(`- Has transaction: ${!!availablePayout.transaction}`);
    
    // Create a test receipt for this payout
    const testReceipt = await prisma.receipt.create({
      data: {
        amount: amount,
        recipientPhone: availablePayout.wallet.startsWith('7') ? `+${availablePayout.wallet}` : availablePayout.wallet,
        recipientName: 'Test User',
        bank: 'Tinkoff',
        transactionDate: new Date(),
        operationId: `TEST-${Date.now()}`,
        isParsed: true,
        isProcessed: false,
        filePath: 'data/receipts/test-receipt.pdf',
        fileHash: `test-hash-${Date.now()}`
      }
    });
    
    console.log(`\n✅ Created test receipt ${testReceipt.id}`);
    
    // Run linker for this specific receipt
    console.log('\n🔄 Running ReceiptPayoutLinker...');
    const linker = getReceiptPayoutLinker();
    const result = await linker.linkSpecificReceipt(testReceipt.id);
    
    console.log(`\nLinking result: ${result ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // Check final status
    const finalReceipt = await prisma.receipt.findUnique({
      where: { id: testReceipt.id }
    });
    
    const finalTransaction = availablePayout.transaction ? await prisma.transaction.findUnique({
      where: { id: availablePayout.transaction.id }
    }) : null;
    
    console.log('\n📊 Final status:');
    console.log(`- Receipt linked: ${!!finalReceipt?.payoutId}`);
    console.log(`- Receipt payout ID: ${finalReceipt?.payoutId || 'N/A'}`);
    console.log(`- Transaction status: ${finalTransaction?.status || 'N/A'}`);
    
    // Cleanup test receipt
    await prisma.receipt.delete({
      where: { id: testReceipt.id }
    });
    console.log('\n🧹 Test receipt cleaned up');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewReceiptLinking();