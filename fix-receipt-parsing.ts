import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function fixReceiptParsing() {
  try {
    // Find the receipt by filename
    const receipt = await prisma.receipt.findFirst({
      where: {
        filename: 'receipt_2025-06-20T14-15-48_Receipt.pdf'
      }
    });

    if (!receipt) {
      console.log('Receipt not found');
      return;
    }

    console.log('\n📄 Found receipt:', receipt.id);
    console.log('Current data:');
    console.log('  Amount:', receipt.amount);
    console.log('  Recipient Name:', receipt.recipientName);
    console.log('  Recipient Phone:', receipt.recipientPhone);
    console.log('  Recipient Bank:', receipt.recipientBank);
    console.log('  Parse Error:', receipt.parseError);

    // Get parsedData
    const parsedData = receipt.parsedData as any;
    if (!parsedData) {
      console.log('\n❌ No parsedData found');
      return;
    }

    console.log('\n✅ Parsed data found:');
    console.log('  Amount:', parsedData.amount);
    console.log('  Recipient Name:', parsedData.recipientName);
    console.log('  Recipient Phone:', parsedData.recipientPhone);
    console.log('  Recipient Bank:', parsedData.recipientBank);

    // Update the receipt with correct data
    const updated = await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        amount: parsedData.amount || receipt.amount,
        recipientName: parsedData.recipientName || receipt.recipientName,
        recipientPhone: parsedData.recipientPhone || null,
        recipientBank: parsedData.recipientBank || null,
        recipientCard: parsedData.recipientCard || null,
        parseError: null, // Clear the error
        isParsed: true,
        updatedAt: new Date()
      }
    });

    console.log('\n✅ Receipt updated successfully!');
    console.log('New data:');
    console.log('  Amount:', updated.amount);
    console.log('  Recipient Name:', updated.recipientName);
    console.log('  Recipient Phone:', updated.recipientPhone);
    console.log('  Recipient Bank:', updated.recipientBank);

    // Now check if this receipt can be linked to any payout
    console.log('\n🔍 Checking for matching payouts...');
    
    // Search by recipient name
    if (updated.recipientName) {
      const payoutByName = await prisma.payout.findFirst({
        where: {
          recipientName: {
            contains: updated.recipientName
          },
          status: 5 // Waiting confirmation
        }
      });

      if (payoutByName) {
        console.log(`\n✅ Found matching payout by name: ${payoutByName.gatePayoutId}`);
        console.log(`  Amount: ${payoutByName.amount}`);
        console.log(`  Recipient: ${payoutByName.recipientName}`);
        
        // Extract phone from trader field if available
        const trader = payoutByName.trader as any;
        if (trader?.phone) {
          console.log(`  Phone in payout: ${trader.phone}`);
          console.log(`  Phone in receipt: ${updated.recipientPhone}`);
        }
      }
    }

    // Search by amount
    const payoutsByAmount = await prisma.payout.findMany({
      where: {
        amount: updated.amount,
        status: 5
      }
    });

    if (payoutsByAmount.length > 0) {
      console.log(`\n📊 Found ${payoutsByAmount.length} payouts with matching amount:`);
      for (const payout of payoutsByAmount) {
        console.log(`  - ${payout.gatePayoutId}: ${payout.recipientName} (${payout.recipientPhone})`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixReceiptParsing();