import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function fixAllReceipts() {
  try {
    // Find all receipts with parse errors or missing data
    const receiptsToFix = await prisma.receipt.findMany({
      where: {
        OR: [
          { parseError: { not: null } },
          { recipientPhone: null },
          { recipientBank: null }
        ]
      }
    });

    console.log(`\n📋 Found ${receiptsToFix.length} receipts to check\n`);

    let fixedCount = 0;
    
    for (const receipt of receiptsToFix) {
      console.log(`\n📄 Processing receipt: ${receipt.filename}`);
      console.log(`  Current state:`);
      console.log(`    Amount: ${receipt.amount}`);
      console.log(`    Recipient Name: ${receipt.recipientName}`);
      console.log(`    Recipient Phone: ${receipt.recipientPhone}`);
      console.log(`    Recipient Bank: ${receipt.recipientBank}`);
      console.log(`    Parse Error: ${receipt.parseError}`);
      
      // Check if we have parsedData
      const parsedData = receipt.parsedData as any;
      if (!parsedData) {
        console.log(`  ❌ No parsedData found`);
        continue;
      }
      
      // Check if parsedData has the missing fields
      const hasNewData = (parsedData.recipientPhone && !receipt.recipientPhone) ||
                        (parsedData.recipientBank && !receipt.recipientBank) ||
                        (parsedData.recipientName && !receipt.recipientName) ||
                        receipt.parseError;
      
      if (hasNewData) {
        console.log(`  ✅ Found data in parsedData:`);
        console.log(`    Amount: ${parsedData.amount}`);
        console.log(`    Recipient Name: ${parsedData.recipientName}`);
        console.log(`    Recipient Phone: ${parsedData.recipientPhone}`);
        console.log(`    Recipient Bank: ${parsedData.recipientBank}`);
        
        // Update the receipt
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            amount: parsedData.amount || receipt.amount,
            recipientName: parsedData.recipientName || receipt.recipientName,
            recipientPhone: parsedData.recipientPhone || receipt.recipientPhone,
            recipientBank: parsedData.recipientBank || receipt.recipientBank,
            recipientCard: parsedData.recipientCard || receipt.recipientCard,
            parseError: null,
            isParsed: true,
            updatedAt: new Date()
          }
        });
        
        console.log(`  ✅ Receipt updated!`);
        fixedCount++;
      } else {
        console.log(`  ℹ️ No new data to update`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} receipts out of ${receiptsToFix.length} checked`);
    
    // Show summary of all receipts
    const allReceipts = await prisma.receipt.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📊 All receipts summary:`);
    for (const receipt of allReceipts) {
      const status = receipt.parseError ? '❌' : 
                    receipt.recipientPhone && receipt.recipientBank ? '✅' : '⚠️';
      console.log(`${status} ${receipt.filename}`);
      console.log(`   Amount: ${receipt.amount}, Name: ${receipt.recipientName}`);
      console.log(`   Phone: ${receipt.recipientPhone || 'N/A'}, Bank: ${receipt.recipientBank || 'N/A'}`);
      if (receipt.payoutId) {
        console.log(`   💰 Linked to payout: ${receipt.payoutId}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllReceipts();