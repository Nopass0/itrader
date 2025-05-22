import { PrismaClient } from '@prisma/client';
import { realGateService } from './realGateService.js';
import { websocketService } from './websocketService.js';

class GateDataSyncService {
  private prisma: PrismaClient;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Start the sync service
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[GateDataSync] Starting sync service...');
    
    // Initial sync
    this.syncAllAccounts();
    
    // Set up interval for every 5 minutes to avoid rate limiting
    this.syncInterval = setInterval(() => {
      this.syncAllAccounts();
    }, 5 * 60 * 1000);
  }

  // Stop the sync service
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('[GateDataSync] Sync service stopped');
  }

  // Sync all active Gate accounts
  private async syncAllAccounts() {
    try {
      const activeAccounts = await this.prisma.gateCredentials.findMany({
        where: { status: 'active' },
        include: { user: true }
      });

      console.log(`[GateDataSync] Syncing ${activeAccounts.length} active accounts...`);

      for (const account of activeAccounts) {
        await this.syncAccount(account.userId);
      }
    } catch (error) {
      console.error('[GateDataSync] Error syncing accounts:', error);
    }
  }

  // Sync a specific account
  async syncAccount(userId: number) {
    try {
      // Get active session
      let sessionResult = await realGateService.getActiveSession(userId);
      
      // If no active session exists, try to authenticate the user
      if (!sessionResult.success) {
        console.log(`[GateDataSync] No active session for user ${userId}, attempting authentication...`);
        
        // Get user's Gate credentials
        const credentials = await this.prisma.gateCredentials.findUnique({
          where: { userId }
        });
        
        if (!credentials) {
          console.warn(`[GateDataSync] No Gate credentials found for user ${userId}`);
          return;
        }
        
        // Attempt to authenticate and create session
        await realGateService.initializeAccount(credentials.id, credentials.email, credentials.password);
        
        // Try to get session again after authentication
        sessionResult = await realGateService.getActiveSession(userId);
        if (!sessionResult.success) {
          console.error(`[GateDataSync] Failed to create session for user ${userId} after authentication`);
          return;
        }
      }

      // Sync dashboard stats for different time periods
      await this.syncDashboardStats(userId);
      
      // Add delay between different sync types to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Sync transactions
      await this.syncTransactions(userId);
      
      // Add delay between different sync types
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Sync SMS messages
      await this.syncSmsMessages(userId);
      
      // Add delay between different sync types
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Sync push notifications
      await this.syncPushNotifications(userId);

      console.log(`[GateDataSync] Successfully synced user ${userId}`);
      
      // Notify frontend via WebSocket
      websocketService.notifyUserDataUpdate(userId, {
        type: 'sync_complete',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`[GateDataSync] Error syncing user ${userId}:`, error);
    }
  }

  // Sync dashboard statistics
  private async syncDashboardStats(userId: number) {
    const stepConfigs = [
      { type: 'hour', value: 3600 },
      { type: 'day', value: 86400 },
      { type: 'week', value: 604800 },
      { type: 'month', value: 2592000 }
    ];

    console.log(`[GateDataSync] Syncing dashboard stats for user ${userId}, ${stepConfigs.length} step types`);

    for (const config of stepConfigs) {
      try {
        console.log(`[GateDataSync] Fetching dashboard stats ${config.type} (step=${config.value}) for user ${userId}`);
        const result = await realGateService.getDashboardStats(userId, config.value);
        
        // Add delay between dashboard stat requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`[GateDataSync] Dashboard stats ${config.type} result:`, {
          success: result.success,
          hasData: !!result.data,
          graphLength: result.data?.graph?.length || 0,
          avgLength: result.data?.avg?.payments?.length || 0
        });
        
        if (result.success && result.data) {
          // Check if record exists
          const existingStats = await this.prisma.gateDashboardStats.findFirst({
            where: {
              userId,
              stepType: config.type
            }
          });

          if (existingStats) {
            // Update existing record
            await this.prisma.gateDashboardStats.update({
              where: {
                id: existingStats.id
              },
              data: {
                graphData: result.data.graph,
                avgData: result.data.avg,
                updatedAt: new Date()
              }
            });
          } else {
            // Create new record
            await this.prisma.gateDashboardStats.create({
              data: {
                userId,
                stepType: config.type,
                stepValue: config.value,
                graphData: result.data.graph,
                avgData: result.data.avg
              }
            });
          }
          console.log(`[GateDataSync] Dashboard stats ${config.type} saved successfully for user ${userId}`);
        } else {
          console.warn(`[GateDataSync] Dashboard stats ${config.type} failed or empty for user ${userId}:`, result.error);
        }
      } catch (error) {
        console.error(`[GateDataSync] Error syncing dashboard stats (${config.type}) for user ${userId}:`, error);
      }
    }
  }

  // Sync transactions
  private async syncTransactions(userId: number) {
    try {
      const result = await realGateService.getTransactions(userId, 1, {});
      if (!result.success || !result.data) return;

      for (const transaction of result.data.transactions) {
        try {
          await this.prisma.gateTransaction.upsert({
            where: { gateId: transaction.id.toString() },
            update: {
              status: transaction.status,
              statusText: this.getStatusText(transaction.status),
              amount: typeof transaction.amount === 'object' ? JSON.stringify(transaction.amount) : (transaction.amount || '0'),
              currency: transaction.currency || 'unknown',
              amountUsdt: typeof transaction.amount_usdt === 'object' ? JSON.stringify(transaction.amount_usdt) : (transaction.amount_usdt || '0'),
              fee: typeof transaction.fee === 'object' ? JSON.stringify(transaction.fee) : (transaction.fee || '0'),
              feeUsdt: typeof transaction.fee_usdt === 'object' ? JSON.stringify(transaction.fee_usdt) : (transaction.fee_usdt || '0'),
              wallet: transaction.wallet || '',
              fromAddress: transaction.from_address || null,
              toAddress: transaction.to_address || null,
              txHash: transaction.tx_hash || null,
              network: transaction.network || null,
              memo: transaction.memo || null,
              description: transaction.description || null,
              rawData: transaction,
              processedAt: new Date(transaction.created_at),
              updatedAt: new Date()
            },
            create: {
              gateId: transaction.id.toString(),
              userId,
              type: transaction.type || 'unknown',
              status: transaction.status,
              statusText: this.getStatusText(transaction.status),
              amount: typeof transaction.amount === 'object' ? JSON.stringify(transaction.amount) : (transaction.amount || '0'),
              currency: transaction.currency || 'unknown',
              amountUsdt: typeof transaction.amount_usdt === 'object' ? JSON.stringify(transaction.amount_usdt) : (transaction.amount_usdt || '0'),
              fee: typeof transaction.fee === 'object' ? JSON.stringify(transaction.fee) : (transaction.fee || '0'),
              feeUsdt: typeof transaction.fee_usdt === 'object' ? JSON.stringify(transaction.fee_usdt) : (transaction.fee_usdt || '0'),
              wallet: transaction.wallet || '',
              fromAddress: transaction.from_address || null,
              toAddress: transaction.to_address || null,
              txHash: transaction.tx_hash || null,
              network: transaction.network || null,
              memo: transaction.memo || null,
              description: transaction.description || null,
              rawData: transaction,
              processedAt: new Date(transaction.created_at)
            }
          });
        } catch (error) {
          console.error(`[GateDataSync] Error upserting transaction ${transaction.id}:`, error);
        }
      }

      // Notify WebSocket about new transactions
      websocketService.notifyUserDataUpdate(userId, {
        type: 'transactions_updated',
        count: result.data.transactions.length
      });

    } catch (error) {
      console.error(`[GateDataSync] Error syncing transactions for user ${userId}:`, error);
    }
  }

  // Sync SMS messages
  private async syncSmsMessages(userId: number) {
    try {
      const result = await realGateService.getSmsMessages(userId, 1);
      if (!result.success || !result.data) return;

      for (const sms of result.data.messages) {
        try {
          await this.prisma.gateSms.upsert({
            where: { gateId: sms.id.toString() },
            update: {
              from: sms.from,
              text: sms.text,
              status: sms.status,
              statusText: this.getStatusText(sms.status),
              receivedAt: new Date(sms.received_at),
              deviceId: sms.device.id.toString(),
              deviceName: sms.device.name,
              parsed: sms.parsed,
              rawData: sms,
              updatedAt: new Date()
            },
            create: {
              gateId: sms.id.toString(),
              userId,
              from: sms.from,
              text: sms.text,
              status: sms.status,
              statusText: this.getStatusText(sms.status),
              receivedAt: new Date(sms.received_at),
              deviceId: sms.device.id.toString(),
              deviceName: sms.device.name,
              parsed: sms.parsed,
              rawData: sms
            }
          });
        } catch (error) {
          console.error(`[GateDataSync] Error upserting SMS ${sms.id}:`, error);
        }
      }

      // Notify WebSocket about new SMS
      websocketService.notifyUserDataUpdate(userId, {
        type: 'sms_updated',
        count: result.data.messages.length
      });

    } catch (error) {
      console.error(`[GateDataSync] Error syncing SMS for user ${userId}:`, error);
    }
  }

  // Sync push notifications
  private async syncPushNotifications(userId: number) {
    try {
      const result = await realGateService.getPushNotifications(userId, 1);
      if (!result.success || !result.data) return;

      for (const push of result.data.notifications) {
        try {
          await this.prisma.gatePush.upsert({
            where: { gateId: push.id.toString() },
            update: {
              packageName: push.package_name,
              title: push.title,
              text: push.text,
              status: push.status,
              statusText: this.getStatusText(push.status),
              receivedAt: new Date(push.received_at),
              deviceId: push.device.id.toString(),
              deviceName: push.device.name,
              parsed: push.parsed,
              rawData: push,
              updatedAt: new Date()
            },
            create: {
              gateId: push.id.toString(),
              userId,
              packageName: push.package_name,
              title: push.title,
              text: push.text,
              status: push.status,
              statusText: this.getStatusText(push.status),
              receivedAt: new Date(push.received_at),
              deviceId: push.device.id.toString(),
              deviceName: push.device.name,
              parsed: push.parsed,
              rawData: push
            }
          });
        } catch (error) {
          console.error(`[GateDataSync] Error upserting push notification ${push.id}:`, error);
        }
      }

      // Notify WebSocket about new push notifications
      websocketService.notifyUserDataUpdate(userId, {
        type: 'push_updated',
        count: result.data.notifications.length
      });

    } catch (error) {
      console.error(`[GateDataSync] Error syncing push notifications for user ${userId}:`, error);
    }
  }

  // Helper method to get status text
  private getStatusText(status: number): string {
    const statusMap: { [key: number]: string } = {
      0: 'Создана',
      1: 'В обработке', 
      2: 'Завершена',
      3: 'Ошибка',
      4: 'Отменена',
      5: 'Истекла',
      6: 'Отклонена',
      7: 'Подтверждена',
      8: 'Ожидает подтверждения',
      9: 'Частично выполнена',
      10: 'Заморожена'
    };
    return statusMap[status] || `Статус ${status}`;
  }

  // Manual sync trigger for specific account
  async triggerSync(userId: number) {
    console.log(`[GateDataSync] Manual sync triggered for user ${userId}`);
    await this.syncAccount(userId);
  }

  // Get sync status
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.syncInterval !== null
    };
  }
}

export const gateDataSyncService = new GateDataSyncService();