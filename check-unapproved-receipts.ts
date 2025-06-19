import { db } from './src/db';
import { createLogger } from './src/logger';
import { GateClient } from './src/gate/client';
const logger = createLogger('CheckUnapprovedReceipts');

async function checkUnapprovedReceipts() {
  console.log('Starting check for unapproved receipts...');
  logger.info('Starting check for unapproved receipts...');
  
  try {
    console.log('Connecting to database...');
    await db.connect();
    console.log('Connected to database');
    logger.info('Connected to database');
    
    // 1. Find all transactions with receipts but not approved
    const transactionsWithReceipts = await db.client.transaction.findMany({
      where: {
        OR: [
          { status: 'payment_confirmed' },
          { status: 'receipt_received' }
        ],
        tinkoffReceipt: {
          isNot: null
        }
      },
      include: {
        tinkoffReceipt: true,
        payout: {
          include: {
            advertisement: true
          }
        }
      }
    });

    console.log(`Found ${transactionsWithReceipts.length} transactions with receipts`);
    logger.info(`Found ${transactionsWithReceipts.length} transactions with receipts`);

    if (transactionsWithReceipts.length === 0) {
      console.log('No transactions with receipts found');
      logger.info('No transactions with receipts found');
      return;
    }

    // Initialize Gate client
    const gateClient = new GateClient({});
    
    // Load cookies for authentication
    try {
      await gateClient.loadCookies('gate_cookies.json');
      logger.info('Gate client authenticated with saved cookies');
    } catch (error) {
      logger.error('Failed to load Gate cookies:', error);
      logger.warn('Some Gate API calls may fail without authentication');
    }

    // Check each transaction
    for (const transaction of transactionsWithReceipts) {
      logger.info(`\n=== Checking Transaction ${transaction.id} ===`);
      logger.info('Transaction details:', {
        id: transaction.id,
        status: transaction.status,
        gateOrderId: transaction.payout?.id,
        receiptId: transaction.tinkoffReceipt?.id,
        receiptStatus: transaction.tinkoffReceipt?.status,
        createdAt: transaction.createdAt
      });

      if (!transaction.payout?.id) {
        logger.warn(`Transaction ${transaction.id} has no payout/gateOrderId`);
        continue;
      }

      try {
        // Check Gate order status
        const gateOrder = await gateClient.getTransactionDetails(transaction.payout.id);
        
        logger.info(`Gate order status:`, {
          orderId: gateOrder.id,
          status: gateOrder.status,
          statusString: getGateStatusString(gateOrder.status)
        });

        // Status 7 = completed/approved in Gate
        if (gateOrder.status !== 7) {
          logger.warn(`Transaction ${transaction.id} not approved in Gate:`, {
            currentStatus: gateOrder.status,
            statusString: getGateStatusString(gateOrder.status),
            hasReceipt: !!transaction.tinkoffReceipt,
            receiptStatus: transaction.tinkoffReceipt?.status
          });

          // Check if receipt is matched
          if (transaction.tinkoffReceipt && transaction.tinkoffReceipt.status === 'MATCHED') {
            logger.error(`ISSUE FOUND: Transaction ${transaction.id} has matched receipt but not approved in Gate!`);
          }
        } else {
          logger.info(`Transaction ${transaction.id} is already approved in Gate`);
        }
      } catch (error) {
        logger.error(`Error checking Gate order for transaction ${transaction.id}:`, error);
      }
    }

    // 2. Check recent receipt matches to see if AssetReleaseService is called
    logger.info('\n=== Checking Recent Receipt Matches ===');
    const recentMatchedReceipts = await db.client.tinkoffReceipt.findMany({
      where: {
        status: 'MATCHED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        transaction: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    logger.info(`Found ${recentMatchedReceipts.length} recently matched receipts`);

    for (const receipt of recentMatchedReceipts) {
      logger.info(`Receipt ${receipt.id}:`, {
        matchedAt: receipt.updatedAt,
        transactionId: receipt.transactionId,
        transactionStatus: receipt.transaction?.status,
        gateOrderId: receipt.transaction?.gateOrderId
      });
    }

    // 3. Check if AssetReleaseService is registered in the app
    const appFile = await db.client.$queryRaw`SELECT 1`; // Just to ensure DB connection
    logger.info('\n=== Checking AssetReleaseService Integration ===');
    logger.info('Please manually verify that AssetReleaseService is:');
    logger.info('1. Imported in src/app.ts');
    logger.info('2. Started when receipts are matched');
    logger.info('3. Properly configured with Gate credentials');

  } catch (error) {
    logger.error('Error checking unapproved receipts:', error);
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

checkUnapprovedReceipts()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });