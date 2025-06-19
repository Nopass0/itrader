import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function demoReceiptFlow() {
  console.log('🎬 Demo: Receipt Processing Flow\n');
  
  // 1. Create a test transaction
  console.log('1️⃣ Creating test transaction...');
  
  // Find an active advertisement without existing transaction
  const advertisement = await prisma.advertisement.findFirst({
    where: { 
      isActive: true,
      transaction: null
    },
    include: { bybitAccount: true }
  });
  
  if (!advertisement) {
    console.log('❌ No active advertisement found. Please create one first.');
    return;
  }
  
  // Find a payout with amount 4500
  const payout = await prisma.payout.findFirst({
    where: {
      OR: [
        { amount: 4500 },
        { 
          amountTrader: {
            path: '$.643',
            equals: 4500
          }
        }
      ],
      status: { in: [5, 6, 7] } // Any status
    }
  });
  
  if (!payout) {
    console.log('❌ No payout with amount 4500 found');
    return;
  }
  
  // Create test transaction
  const transaction = await prisma.transaction.create({
    data: {
      advertisementId: advertisement.id,
      payoutId: payout.id,
      orderId: `demo_order_${Date.now()}`,
      status: 'pending',
      chatStep: 0
    }
  });
  
  console.log(`✅ Created transaction ${transaction.id}`);
  console.log(`   Advertisement: ${advertisement.bybitAdId}`);
  console.log(`   Payout: ${payout.gatePayoutId} (${payout.amountTrader})`);
  
  // 2. Find receipt for this payout amount
  console.log('\n2️⃣ Finding matching receipt...');
  
  const receipt = await prisma.receipt.findFirst({
    where: {
      amount: 4500,
      isParsed: true
    }
  });
  
  if (!receipt) {
    console.log('❌ No parsed receipt with amount 4500 found');
    return;
  }
  
  console.log(`✅ Found receipt ${receipt.id}`);
  console.log(`   Amount: ${receipt.amount}`);
  console.log(`   Phone: ${receipt.recipientPhone}`);
  console.log(`   Operation ID: ${receipt.operationId}`);
  
  // 3. Reset receipt to unlinked state
  console.log('\n3️⃣ Resetting receipt to unlinked state...');
  
  await prisma.receipt.update({
    where: { id: receipt.id },
    data: {
      payoutId: null,
      isProcessed: false
    }
  });
  
  console.log('✅ Receipt reset');
  
  // 4. Run linker service
  console.log('\n4️⃣ Running Receipt Payout Linker...');
  
  const { startReceiptPayoutLinker } = await import('./src/services/receiptPayoutLinkerService');
  const linkerService = await startReceiptPayoutLinker(1000);
  
  // Wait for linking
  await new Promise(resolve => setTimeout(resolve, 3000));
  linkerService.stop();
  
  // 5. Check results
  console.log('\n5️⃣ Checking results...');
  
  const updatedReceipt = await prisma.receipt.findUnique({
    where: { id: receipt.id }
  });
  
  const updatedTransaction = await prisma.transaction.findUnique({
    where: { id: transaction.id }
  });
  
  const updatedPayout = await prisma.payout.findUnique({
    where: { id: payout.id }
  });
  
  console.log('\n📊 Final state:');
  console.log(`Receipt linked to payout: ${updatedReceipt?.payoutId ? '✅' : '❌'}`);
  console.log(`Transaction status: ${updatedTransaction?.status}`);
  console.log(`Payout status: ${updatedPayout?.status}`);
  
  if (updatedTransaction?.status === 'payment_confirmed') {
    console.log('\n⏱️ Transaction is now in payment_confirmed status');
    console.log('   Assets will be released in 2 minutes by AssetReleaseService');
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up demo transaction...');
  await prisma.transaction.delete({
    where: { id: transaction.id }
  });
}

demoReceiptFlow()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());