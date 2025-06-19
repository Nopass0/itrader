import { db } from './src/db';

async function checkReceiptModels() {
  console.log('=== Checking Receipt Models and Approval Flow ===\n');
  
  try {
    await db.connect();
    
    // 1. Check Receipt model data
    console.log('1. Receipt Model Data:');
    const receipts = await db.client.receipt.findMany({});
    console.log(`Total Receipts: ${receipts.length}`);
    
    const receiptWithPayout = receipts.filter(r => r.payoutId);
    console.log(`Receipts with Payout: ${receiptWithPayout.length}`);
    
    if (receipts.length > 0) {
      console.log('\nRecent Receipts:');
      const recentReceipts = await db.client.receipt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      
      for (const r of recentReceipts) {
        console.log(`\nReceipt ${r.id}:`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Amount: ${r.amount}`);
        console.log(`  Has Payout: ${!!r.payoutId}`);
        console.log(`  File Path: ${r.filePath ? 'Yes' : 'No'}`);
        console.log(`  Created: ${r.createdAt.toISOString()}`);
      }
    }
    
    // 2. Check TinkoffReceipt model data
    console.log('\n\n2. TinkoffReceipt Model Data:');
    const tinkoffReceipts = await db.client.tinkoffReceipt.findMany({
      include: {
        transaction: {
          include: {
            payout: true
          }
        }
      }
    });
    console.log(`Total TinkoffReceipts: ${tinkoffReceipts.length}`);
    
    const tinkoffWithTransaction = tinkoffReceipts.filter(r => r.transactionId);
    console.log(`TinkoffReceipts with Transaction: ${tinkoffWithTransaction.length}`);
    
    if (tinkoffReceipts.length > 0) {
      console.log('\nRecent TinkoffReceipts:');
      const recentTinkoff = await db.client.tinkoffReceipt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          transaction: {
            include: {
              payout: true
            }
          }
        }
      });
      
      for (const r of recentTinkoff) {
        console.log(`\nTinkoffReceipt ${r.id}:`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Amount: ${r.amount}`);
        console.log(`  Has Transaction: ${!!r.transactionId}`);
        console.log(`  Transaction Status: ${r.transaction?.status}`);
        console.log(`  Has Payout: ${!!r.transaction?.payout}`);
        console.log(`  PDF Path: ${r.pdfPath ? 'Yes' : 'No'}`);
        console.log(`  Created: ${r.createdAt.toISOString()}`);
      }
    }
    
    // 3. Check transactions that should be approved
    console.log('\n\n3. Transactions that may need approval:');
    const transactionsNeedingApproval = await db.client.transaction.findMany({
      where: {
        receiptReceivedAt: {
          not: null
        },
        payout: {
          status: {
            in: [5, 7] // Waiting confirmation or processing
          }
        }
      },
      include: {
        payout: true,
        tinkoffReceipt: true
      }
    });
    
    console.log(`Found ${transactionsNeedingApproval.length} transactions with receiptReceivedAt set`);
    
    for (const t of transactionsNeedingApproval) {
      console.log(`\nTransaction ${t.id}:`);
      console.log(`  Status: ${t.status}`);
      console.log(`  Receipt Received At: ${t.receiptReceivedAt?.toISOString()}`);
      console.log(`  Payout Status: ${t.payout?.status}`);
      console.log(`  Has TinkoffReceipt: ${!!t.tinkoffReceipt}`);
    }
    
    // 4. Check for receipts linked to payouts
    console.log('\n\n4. Receipts linked to Payouts:');
    const linkedReceipts = await db.client.receipt.findMany({
      where: {
        payoutId: {
          not: null
        }
      }
    });
    
    console.log(`Found ${linkedReceipts.length} receipts linked to payouts`);
    
    for (const r of linkedReceipts.slice(0, 5)) {
      console.log(`\nReceipt ${r.id}:`);
      console.log(`  Payout ID: ${r.payoutId}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Amount: ${r.amount}`);
      
      // Get the linked payout
      if (r.payoutId) {
        const payout = await db.client.payout.findUnique({
          where: { id: r.payoutId },
          include: { transaction: true }
        });
        console.log(`  Payout Status: ${payout?.status}`);
        console.log(`  Has Transaction: ${!!payout?.transaction}`);
        if (payout?.transaction) {
          console.log(`  Transaction Status: ${payout.transaction.status}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.disconnect();
  }
}

checkReceiptModels()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });