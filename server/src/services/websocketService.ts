import { Server as SocketIOServer } from 'socket.io';

interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;

  initialize(io: SocketIOServer) {
    this.io = io;
    console.log('🔌 WebSocket service initialized');
  }

  // Account status events
  emitAccountStatusChange(accountId: number, platform: 'gate' | 'bybit', status: string, errorMessage?: string) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'account_status_change',
      data: {
        accountId,
        platform,
        status,
        errorMessage: errorMessage || null,
        updatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('account_status_change', event);
    console.log(`📡 [WebSocket] Account status change emitted:`, event.data);
  }

  // Session events
  emitSessionUpdate(accountId: number, platform: 'gate' | 'bybit', sessionData: any) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'session_update',
      data: {
        accountId,
        platform,
        sessionData,
        updatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('session_update', event);
    console.log(`📡 [WebSocket] Session update emitted for account ${accountId}`);
  }

  // Transaction events
  emitNewTransaction(accountId: number, platform: 'gate' | 'bybit', transaction: any) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'new_transaction',
      data: {
        accountId,
        platform,
        transaction,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('new_transaction', event);
    console.log(`📡 [WebSocket] New transaction emitted:`, transaction.id);
  }

  // SMS/Push notification events
  emitNewNotification(accountId: number, type: 'sms' | 'push', notification: any) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'new_notification',
      data: {
        accountId,
        notificationType: type,
        notification,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('new_notification', event);
    console.log(`📡 [WebSocket] New ${type} notification emitted for account ${accountId}`);
  }

  // Account balance updates
  emitBalanceUpdate(accountId: number, platform: 'gate' | 'bybit', balances: any) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'balance_update',
      data: {
        accountId,
        platform,
        balances,
        updatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('balance_update', event);
    console.log(`📡 [WebSocket] Balance update emitted for account ${accountId}`);
  }

  // General system events
  emitSystemEvent(type: string, data: any) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: `system_${type}`,
      data,
      timestamp: new Date().toISOString()
    };

    this.io.emit(`system_${type}`, event);
    console.log(`📡 [WebSocket] System event emitted:`, type);
  }

  // Error events
  emitError(accountId: number, platform: 'gate' | 'bybit', error: string, context?: any) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'error',
      data: {
        accountId,
        platform,
        error,
        context: context || null,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('error', event);
    console.log(`📡 [WebSocket] Error emitted for account ${accountId}:`, error);
  }

  // Account initialization progress
  emitInitializationProgress(accountId: number, platform: 'gate' | 'bybit', step: string, progress: number) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'initialization_progress',
      data: {
        accountId,
        platform,
        step,
        progress, // 0-100
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('initialization_progress', event);
    console.log(`📡 [WebSocket] Initialization progress: ${step} (${progress}%) for account ${accountId}`);
  }

  // Send to specific socket
  emitToSocket(socketId: string, event: string, data: any) {
    if (!this.io) return;
    
    this.io.to(socketId).emit(event, {
      type: event,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.io ? this.io.engine.clientsCount : 0;
  }

  // Broadcast stats update
  broadcastStatsUpdate() {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'stats_update',
      data: {
        connectedClients: this.getConnectedClientsCount(),
        serverStatus: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      timestamp: new Date().toISOString()
    };

    this.io.emit('stats_update', event);
  }

  // Notify specific user about data updates
  notifyUserDataUpdate(userId: number, updateData: any) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'user_data_update',
      data: {
        userId,
        ...updateData,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Send to user-specific room
    this.io.to(`user_${userId}`).emit('user_data_update', event);
    console.log(`📡 [WebSocket] User data update sent to user ${userId}:`, updateData);
  }

  // Notify about account dashboard stats update
  notifyDashboardStatsUpdate(userId: number, stepType: string) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'dashboard_stats_update',
      data: {
        userId,
        stepType,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${userId}`).emit('dashboard_stats_update', event);
    console.log(`📡 [WebSocket] Dashboard stats update sent to user ${userId} for ${stepType}`);
  }

  // Notify about new transactions
  notifyNewTransactions(userId: number, transactions: any[]) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'new_transactions',
      data: {
        userId,
        transactions,
        count: transactions.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${userId}`).emit('new_transactions', event);
    console.log(`📡 [WebSocket] New transactions sent to user ${userId}: ${transactions.length} items`);
  }

  // Notify about new SMS messages
  notifyNewSmsMessages(userId: number, messages: any[]) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'new_sms_messages',
      data: {
        userId,
        messages,
        count: messages.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${userId}`).emit('new_sms_messages', event);
    console.log(`📡 [WebSocket] New SMS messages sent to user ${userId}: ${messages.length} items`);
  }

  // Notify about new push notifications
  notifyNewPushNotifications(userId: number, notifications: any[]) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'new_push_notifications',
      data: {
        userId,
        notifications,
        count: notifications.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${userId}`).emit('new_push_notifications', event);
    console.log(`📡 [WebSocket] New push notifications sent to user ${userId}: ${notifications.length} items`);
  }

  // Notify about transaction action completed
  notifyTransactionActionCompleted(userId: number, transactionId: string, action: string, newStatus: number, statusText: string) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'transaction_action_completed',
      data: {
        userId,
        transactionId,
        action,
        newStatus,
        statusText,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${userId}`).emit('transaction_action_completed', event);
    console.log(`📡 [WebSocket] Transaction action completed sent to user ${userId}: ${action} on transaction ${transactionId}`);
  }

  // Notify about transaction status updates from monitoring
  notifyTransactionUpdates(userId: number, updatedTransactions: any[], newTransactions: any[]) {
    if (!this.io) return;

    const event: WebSocketEvent = {
      type: 'transaction_updates',
      data: {
        userId,
        updatedTransactions,
        newTransactions,
        updatedCount: updatedTransactions.length,
        newCount: newTransactions.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${userId}`).emit('transaction_updates', event);
    console.log(`📡 [WebSocket] Transaction updates sent to user ${userId}: ${updatedTransactions.length} updated, ${newTransactions.length} new`);
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();