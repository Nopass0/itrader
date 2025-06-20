import { getReceiptPayoutLinker } from './src/services/receiptPayoutLinkerService';
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function testReceiptLinking() {
  try {
    console.log('\n🔍 Testing Receipt Linking:');
    
    // Get the first unlinked receipt
    const receipt = await prisma.receipt.findFirst({
      where: {
        isParsed: true,
        payoutId: null,
        amount: 2000
      }
    });
    
    if (!receipt) {
      console.log('No unlinked receipt found');
      return;
    }
    
    console.log(`\nTesting with receipt ${receipt.id}:`);
    console.log(`- Amount: ${receipt.amount}`);
    console.log(`- Phone: ${receipt.recipientPhone}`);
    console.log(`- Name: ${receipt.recipientName}`);
    
    // Normalize phone
    const normalizePhone = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      if (digits.startsWith('7') && digits.length === 11) {
        return digits.substring(1);
      }
      if (digits.startsWith('8') && digits.length === 11) {
        return digits.substring(1);
      }
      return digits;
    };
    
    const normalizedPhone = receipt.recipientPhone ? normalizePhone(receipt.recipientPhone) : '';
    console.log(`- Normalized phone: ${normalizedPhone}`);
    
    // Try to find payout
    console.log('\nSearching for matching payout...');
    
    // Search by phone
    if (normalizedPhone) {
      const payoutByPhone = await prisma.payout.findFirst({
        where: {
          wallet: { contains: normalizedPhone },
          OR: [
            { amount: receipt.amount },
            { 
              amountTrader: {
                path: '$.643',
                equals: receipt.amount
              }
            }
          ]
        }
      });
      
      if (payoutByPhone) {
        console.log(`\n✅ Found payout by phone!`);
        console.log(`- Payout ID: ${payoutByPhone.gatePayoutId}`);
        console.log(`- Status: ${payoutByPhone.status}`);
        console.log(`- Wallet: ${payoutByPhone.wallet}`);
        console.log(`- Amount: ${payoutByPhone.amountTrader ? (payoutByPhone.amountTrader as any)['643'] : payoutByPhone.amount}`);
      } else {
        console.log('❌ No payout found by phone');
      }
    }
    
    // Now run the actual linker service
    console.log('\n📦 Running ReceiptPayoutLinker service...');
    const linker = getReceiptPayoutLinker();
    const result = await linker.linkSpecificReceipt(receipt.id);
    
    console.log(`\nLinking result: ${result ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // Check if receipt was linked
    const updatedReceipt = await prisma.receipt.findUnique({
      where: { id: receipt.id }
    });
    
    if (updatedReceipt?.payoutId) {
      console.log(`Receipt linked to payout: ${updatedReceipt.payoutId}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReceiptLinking();