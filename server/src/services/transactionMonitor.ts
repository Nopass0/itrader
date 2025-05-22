import { PrismaClient } from '@prisma/client';
import { RealGateService } from './realGateService';
import { websocketService } from './websocketService.js';

const prisma = new PrismaClient();

export class TransactionMonitorService {
  private realGateService: RealGateService;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.realGateService = new RealGateService();
  }

  start() {
    if (this.isRunning) {
      console.log('Transaction monitor already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting transaction monitor service...');

    // Run immediately and then every minute
    this.checkTransactions();
    this.intervalId = setInterval(() => {
      this.checkTransactions();
    }, 60000); // 1 minute = 60000ms
  }

  stop() {
    if (!this.isRunning) {
      console.log('Transaction monitor not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('Stopped transaction monitor service');
  }

  private async checkTransactions() {
    console.log(`[${new Date().toISOString()}] Checking transactions for all accounts...`);

    try {
      // Get all active Gate.cx accounts
      const accounts = await prisma.gateCredentials.findMany({
        where: {
          status: 'active'
        }
      });

      console.log(`Found ${accounts.length} active Gate.cx accounts`);

      for (const account of accounts) {
        await this.processAccountTransactions(account);
      }
    } catch (error) {
      console.error('Error in transaction monitor:', error);
    }
  }

  private async processAccountTransactions(account: any) {
    try {
      console.log(`Processing transactions for account ${account.id} (${account.email})`);

      const updatedTransactions: any[] = [];
      const newTransactions: any[] = [];

      // Check for pending transactions (status 1)
      const pendingResults = await this.processTransactionsByStatus(account, 1, 'pending');
      updatedTransactions.push(...pendingResults.updated);
      newTransactions.push(...pendingResults.new);
      
      // Check for in-process transactions (status 5)
      const inProcessResults = await this.processTransactionsByStatus(account, 5, 'in-process');
      updatedTransactions.push(...inProcessResults.updated);
      newTransactions.push(...inProcessResults.new);

      // Send WebSocket notification if there are any updates
      if (updatedTransactions.length > 0 || newTransactions.length > 0) {
        websocketService.notifyTransactionUpdates(
          account.userId,
          updatedTransactions,
          newTransactions
        );
      }

    } catch (error) {
      console.error(`Error processing account ${account.id}:`, error);
    }
  }

  private async processTransactionsByStatus(account: any, status: number, statusName: string): Promise<{ updated: any[], new: any[] }> {
    const updated: any[] = [];
    const newTransactions: any[] = [];

    try {
      console.log(`Checking ${statusName} transactions (status ${status}) for account ${account.id}`);

      // Get transactions from Gate.cx API with specific status filter
      const result = await this.realGateService.getTransactions(account.userId, 1, { status });

      if (!result.success) {
        console.error(`Failed to fetch ${statusName} transactions for account ${account.id}:`, result.error);
        return { updated, new: newTransactions };
      }

      const gateTransactions = result.data?.transactions || [];
      console.log(`Found ${gateTransactions.length} ${statusName} transactions from Gate.cx API`);

      for (const gateTransaction of gateTransactions) {
        const transactionResult = await this.updateOrInsertTransaction(account.userId, gateTransaction);
        
        if (transactionResult.isNew) {
          newTransactions.push(transactionResult.transaction);
        } else if (transactionResult.wasUpdated) {
          updated.push(transactionResult.transaction);
        }
      }

    } catch (error) {
      console.error(`Error processing ${statusName} transactions for account ${account.id}:`, error);
    }

    return { updated, new: newTransactions };
  }

  private async updateOrInsertTransaction(userId: number, gateTransaction: any): Promise<{ transaction: any, isNew: boolean, wasUpdated: boolean }> {
    try {
      const gateId = gateTransaction.id.toString();

      // Check if transaction already exists in database
      const existingTransaction = await prisma.gateTransaction.findUnique({
        where: { gateId }
      });

      const transactionData = {
        userId,
        type: gateTransaction.type || 'unknown',
        status: gateTransaction.status,
        statusText: gateTransaction.status_text,
        amount: gateTransaction.amount?.toString() || '0',
        currency: gateTransaction.currency || '',
        amountUsdt: gateTransaction.amount_usdt?.toString(),
        fee: gateTransaction.fee?.toString(),
        feeUsdt: gateTransaction.fee_usdt?.toString(),
        wallet: gateTransaction.wallet,
        fromAddress: gateTransaction.from_address,
        toAddress: gateTransaction.to_address,
        txHash: gateTransaction.tx_hash,
        network: gateTransaction.network,
        memo: gateTransaction.memo,
        description: gateTransaction.description,
        rawData: gateTransaction,
        processedAt: new Date(gateTransaction.created_at || gateTransaction.processed_at || Date.now())
      };

      if (existingTransaction) {
        // Check if any data has changed
        const hasChanges = this.hasTransactionChanges(existingTransaction, transactionData);
        
        if (hasChanges) {
          console.log(`Updating existing transaction ${gateId} for user ${userId}`);
          const updatedTransaction = await prisma.gateTransaction.update({
            where: { gateId },
            data: transactionData
          });
          return { transaction: updatedTransaction, isNew: false, wasUpdated: true };
        } else {
          console.log(`No changes for transaction ${gateId}`);
          return { transaction: existingTransaction, isNew: false, wasUpdated: false };
        }
      } else {
        // Insert new transaction
        console.log(`Inserting new transaction ${gateId} for user ${userId}`);
        const newTransaction = await prisma.gateTransaction.create({
          data: {
            gateId,
            ...transactionData
          }
        });
        return { transaction: newTransaction, isNew: true, wasUpdated: false };
      }
    } catch (error) {
      console.error(`Error updating/inserting transaction ${gateTransaction.id}:`, error);
      return { transaction: null, isNew: false, wasUpdated: false };
    }
  }

  private hasTransactionChanges(existing: any, newData: any): boolean {
    // Compare key fields that might change
    const fieldsToCompare = [
      'status',
      'statusText',
      'amount',
      'amountUsdt',
      'fee',
      'feeUsdt',
      'txHash',
      'description'
    ];

    for (const field of fieldsToCompare) {
      const existingValue = existing[field];
      const newValue = newData[field];
      
      // Handle null/undefined comparisons
      if (existingValue !== newValue) {
        if (existingValue == null && newValue == null) {
          continue; // Both are null/undefined, no change
        }
        console.log(`Transaction ${existing.gateId} field '${field}' changed: '${existingValue}' -> '${newValue}'`);
        return true;
      }
    }

    return false;
  }

  isMonitorRunning(): boolean {
    return this.isRunning;
  }
}

// Export a singleton instance
export const transactionMonitor = new TransactionMonitorService();