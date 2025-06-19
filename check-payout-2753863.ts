import { db } from './src/db';
import { GateClient } from './src/gate/client';

async function checkPayout() {
  console.log('=== Checking Payout 2753863 ===\n');
  
  try {
    await db.connect();
    
    // Find the payout
    const payout = await db.client.payout.findUnique({
      where: { id: '2753863' },
      include: {
        transaction: true,
        advertisement: true
      }
    });
    
    if (!payout) {
      console.log('Payout not found');
      return;
    }
    
    console.log('Payout Details:');
    console.log(`  ID: ${payout.id}`);
    console.log(`  Gate Payout ID: ${payout.gatePayoutId}`);
    console.log(`  Status: ${payout.status}`);
    console.log(`  Amount: ${payout.amount}`);
    console.log(`  Created: ${payout.createdAt.toISOString()}`);
    console.log(`  Has Transaction: ${!!payout.transaction}`);
    
    if (payout.transaction) {
      console.log('\nTransaction Details:');
      console.log(`  ID: ${payout.transaction.id}`);
      console.log(`  Status: ${payout.transaction.status}`);
      console.log(`  Receipt Received At: ${payout.transaction.receiptReceivedAt}`);
    }
    
    // Find the receipt
    const receipt = await db.client.receipt.findFirst({
      where: { payoutId: payout.id }
    });
    
    if (receipt) {
      console.log('\nReceipt Details:');
      console.log(`  ID: ${receipt.id}`);
      console.log(`  Status: ${receipt.status}`);
      console.log(`  Amount: ${receipt.amount}`);
      console.log(`  File Path: ${receipt.filePath}`);
      console.log(`  Created: ${receipt.createdAt.toISOString()}`);
    }
    
    // Check Gate status if we have gatePayoutId
    if (payout.gatePayoutId) {
      console.log('\nChecking Gate status...');
      const gateClient = new GateClient({});
      
      try {
        await gateClient.loadCookies('gate_cookies.json');
        const gateOrder = await gateClient.getTransactionDetails(payout.id);
        console.log(`Gate Order Status: ${gateOrder.status} (${getGateStatusString(gateOrder.status)})`);
        
        if (gateOrder.status !== 7 && receipt) {
          console.log('\n⚠️  ISSUE: Receipt exists but Gate order not approved!');
          console.log('This transaction should be approved by AssetReleaseService');
        }
      } catch (error) {
        console.log(`Error checking Gate: ${error}`);
      }
    }
    
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

checkPayout()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });