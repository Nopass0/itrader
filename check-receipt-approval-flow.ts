import { db } from './src/db';
import { createLogger } from './src/logger';
import { GateClient } from './src/gate/client';

const logger = createLogger('CheckReceiptApprovalFlow');

async function checkReceiptApprovalFlow() {
  console.log('=== Checking Receipt Approval Flow ===\n');
  
  try {
    await db.connect();
    console.log('Connected to database\n');
    
    // 1. Check all transactions with TinkoffReceipts
    console.log('1. Checking all transactions with TinkoffReceipts:');
    const transactionsWithReceipts = await db.client.transaction.findMany({
      where: {
        tinkoffReceipt: {
          isNot: null
        }
      },
      include: {
        tinkoffReceipt: true,
        payout: true
      }
    });
    
    console.log(`Found ${transactionsWithReceipts.length} transactions with receipts\n`);
    
    // Group by status
    const statusGroups = transactionsWithReceipts.reduce((acc, t) => {
      const status = t.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(t);
      return acc;
    }, {} as Record<string, typeof transactionsWithReceipts>);
    
    console.log('Transaction status breakdown:');
    for (const [status, transactions] of Object.entries(statusGroups)) {
      console.log(`  ${status}: ${transactions.length} transactions`);
    }
    console.log('');
    
    // 2. Check TinkoffReceipt statuses
    console.log('2. Checking TinkoffReceipt statuses:');
    const receipts = await db.client.tinkoffReceipt.findMany({
      include: {
        transaction: true
      }
    });
    
    const receiptStatusGroups = receipts.reduce((acc, r) => {
      const status = r.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(r);
      return acc;
    }, {} as Record<string, typeof receipts>);
    
    console.log('Receipt status breakdown:');
    for (const [status, recs] of Object.entries(receiptStatusGroups)) {
      console.log(`  ${status}: ${recs.length} receipts`);
    }
    console.log('');
    
    // 3. Check for MATCHED receipts without approved transactions
    console.log('3. Checking for MATCHED receipts without approved transactions:');
    const matchedReceipts = receipts.filter(r => r.status === 'MATCHED');
    
    if (matchedReceipts.length > 0) {
      const gateClient = new GateClient({});
      
      // Try to load cookies
      try {
        await gateClient.loadCookies('gate_cookies.json');
        console.log('Gate client authenticated\n');
      } catch (error) {
        console.log('Warning: Could not load Gate cookies\n');
      }
      
      for (const receipt of matchedReceipts) {
        console.log(`\nReceipt ${receipt.id}:`);
        console.log(`  Status: ${receipt.status}`);
        console.log(`  Amount: ${receipt.amount}`);
        console.log(`  Transaction ID: ${receipt.transactionId}`);
        console.log(`  Transaction Status: ${receipt.transaction?.status}`);
        
        if (receipt.transaction?.payout?.id) {
          try {
            const gateOrder = await gateClient.getTransactionDetails(receipt.transaction.payout.id);
            console.log(`  Gate Order Status: ${gateOrder.status} (${getGateStatusString(gateOrder.status)})`);
            
            if (gateOrder.status !== 7) {
              console.log(`  ⚠️  WARNING: Matched receipt but Gate order not approved!`);
            }
          } catch (error) {
            console.log(`  ❌ Error checking Gate order: ${error}`);
          }
        } else {
          console.log(`  ⚠️  No payout ID for transaction`);
        }
      }
    } else {
      console.log('No MATCHED receipts found');
    }
    
    // 4. Check recent transactions to understand the flow
    console.log('\n\n4. Recent transaction flow (last 10 transactions):');
    const recentTransactions = await db.client.transaction.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      include: {
        tinkoffReceipt: true,
        payout: true
      }
    });
    
    for (const t of recentTransactions) {
      console.log(`\nTransaction ${t.id}:`);
      console.log(`  Created: ${t.createdAt.toISOString()}`);
      console.log(`  Status: ${t.status}`);
      console.log(`  Amount: ${t.amount}`);
      console.log(`  Has Receipt: ${!!t.tinkoffReceipt}`);
      if (t.tinkoffReceipt) {
        console.log(`  Receipt Status: ${t.tinkoffReceipt.status}`);
      }
      console.log(`  Has Payout: ${!!t.payout}`);
      if (t.payout) {
        console.log(`  Payout Status: ${t.payout.status}`);
      }
    }
    
    // 5. Check if AssetReleaseService is being called
    console.log('\n\n5. Checking AssetReleaseService integration:');
    console.log('Please check the following in src/app.ts:');
    console.log('  - AssetReleaseService is imported');
    console.log('  - AssetReleaseService is initialized and started');
    console.log('  - It\'s called when receipts are matched in ReceiptMatcher or ReceiptProcessor');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.disconnect();
  }
}

function getGateStatusString(status: number): string {
  const statusMap: Record<number, string> = {
    1: 'pending',
    2: 'buyer_paid',
    3: 'disputed',
    4: 'cancelled',
    5: 'timeout_cancelled',
    6: 'seller_confirmed',
    7: 'completed',
    8: 'buyer_cancelled',
    9: 'seller_cancelled'
  };
  return statusMap[status] || 'unknown';
}

checkReceiptApprovalFlow()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });