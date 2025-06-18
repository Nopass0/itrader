import { useEffect, useCallback, useState } from 'react';
import { websocketService } from '@/services/websocket';

interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

// Hook for account status changes
export function useAccountStatusChanges() {
  const [accountStatuses, setAccountStatuses] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    const handleStatusChange = (event: WebSocketEvent) => {
      const { accountId, platform, status, errorMessage, updatedAt } = event.data;
      
      setAccountStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(accountId, {
          platform,
          status,
          errorMessage,
          updatedAt,
          timestamp: event.timestamp
        });
        return newMap;
      });
    };

    websocketService.on('account_status_change', handleStatusChange);

    return () => {
      websocketService.off('account_status_change', handleStatusChange);
    };
  }, []);

  return accountStatuses;
}

// Hook for session updates
export function useSessionUpdates() {
  const [sessions, setSessions] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    const handleSessionUpdate = (event: WebSocketEvent) => {
      const { accountId, platform, sessionData, updatedAt } = event.data;
      
      setSessions(prev => {
        const newMap = new Map(prev);
        newMap.set(accountId, {
          platform,
          sessionData,
          updatedAt,
          timestamp: event.timestamp
        });
        return newMap;
      });
    };

    websocketService.on('session_update', handleSessionUpdate);

    return () => {
      websocketService.off('session_update', handleSessionUpdate);
    };
  }, []);

  return sessions;
}

// Hook for new transactions
export function useNewTransactions() {
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const handleNewTransaction = (event: WebSocketEvent) => {
      const { accountId, platform, transaction } = event.data;
      
      setTransactions(prev => [
        {
          ...transaction,
          accountId,
          platform,
          receivedAt: event.timestamp
        },
        ...prev.slice(0, 99) // Keep only last 100 transactions
      ]);
    };

    websocketService.on('new_transaction', handleNewTransaction);

    return () => {
      websocketService.off('new_transaction', handleNewTransaction);
    };
  }, []);

  return transactions;
}

// Hook for new notifications (SMS/Push)
export function useNewNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const handleNewNotification = (event: WebSocketEvent) => {
      const { accountId, notificationType, notification } = event.data;
      
      setNotifications(prev => [
        {
          ...notification,
          accountId,
          type: notificationType,
          receivedAt: event.timestamp
        },
        ...prev.slice(0, 49) // Keep only last 50 notifications
      ]);
    };

    websocketService.on('new_notification', handleNewNotification);

    return () => {
      websocketService.off('new_notification', handleNewNotification);
    };
  }, []);

  return notifications;
}

// Hook for balance updates
export function useBalanceUpdates() {
  const [balances, setBalances] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    const handleBalanceUpdate = (event: WebSocketEvent) => {
      const { accountId, platform, balances: accountBalances, updatedAt } = event.data;
      
      setBalances(prev => {
        const newMap = new Map(prev);
        newMap.set(accountId, {
          platform,
          balances: accountBalances,
          updatedAt,
          timestamp: event.timestamp
        });
        return newMap;
      });
    };

    websocketService.on('balance_update', handleBalanceUpdate);

    return () => {
      websocketService.off('balance_update', handleBalanceUpdate);
    };
  }, []);

  return balances;
}

// Hook for initialization progress
export function useInitializationProgress() {
  const [progressData, setProgressData] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    const handleProgress = (event: WebSocketEvent) => {
      const { accountId, platform, step, progress } = event.data;
      
      setProgressData(prev => {
        const newMap = new Map(prev);
        newMap.set(accountId, {
          platform,
          step,
          progress,
          timestamp: event.timestamp
        });
        return newMap;
      });
    };

    websocketService.on('initialization_progress', handleProgress);

    return () => {
      websocketService.off('initialization_progress', handleProgress);
    };
  }, []);

  return progressData;
}

// Hook for WebSocket connection status
export function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(websocketService.isConnected());

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    websocketService.onConnect(handleConnect);
    websocketService.onDisconnect(handleDisconnect);

    // Check initial connection status
    setIsConnected(websocketService.isConnected());

    return () => {
      // Note: websocketService doesn't have a method to remove specific handlers
      // This is acceptable as the service is a singleton
    };
  }, []);

  const reconnect = useCallback(() => {
    websocketService.reconnect();
  }, []);

  return { isConnected, reconnect };
}

// Hook for system stats
export function useSystemStats() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const handleStatsUpdate = (event: WebSocketEvent) => {
      setStats(event.data);
    };

    websocketService.on('stats_update', handleStatsUpdate);

    return () => {
      websocketService.off('stats_update', handleStatsUpdate);
    };
  }, []);

  return stats;
}

// Hook for error events
export function useWebSocketErrors() {
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    const handleError = (event: WebSocketEvent) => {
      const { accountId, platform, error, context } = event.data;
      
      setErrors(prev => [
        {
          accountId,
          platform,
          error,
          context,
          timestamp: event.timestamp
        },
        ...prev.slice(0, 19) // Keep only last 20 errors
      ]);
    };

    websocketService.on('error', handleError);

    return () => {
      websocketService.off('error', handleError);
    };
  }, []);

  return errors;
}

// Combined hook for account-specific updates
export function useAccountUpdates(accountId: number, platform: 'gate' | 'bybit') {
  const accountStatuses = useAccountStatusChanges();
  const sessions = useSessionUpdates();
  const balances = useBalanceUpdates();
  const progress = useInitializationProgress();

  useEffect(() => {
    // Join account-specific room when component mounts
    websocketService.joinAccountRoom(accountId, platform);
  }, [accountId, platform]);

  return {
    status: accountStatuses.get(accountId),
    session: sessions.get(accountId),
    balance: balances.get(accountId),
    progress: progress.get(accountId)
  };
}

// Hook for transaction action completions
export function useTransactionActions() {
  const [actionResults, setActionResults] = useState<any[]>([]);

  useEffect(() => {
    const handleActionCompleted = (event: WebSocketEvent) => {
      const { userId, transactionId, action, newStatus, statusText } = event.data;
      
      setActionResults(prev => [
        {
          userId,
          transactionId,
          action,
          newStatus,
          statusText,
          timestamp: event.timestamp
        },
        ...prev.slice(0, 49) // Keep only last 50 action results
      ]);
    };

    websocketService.on('transaction_action_completed', handleActionCompleted);

    return () => {
      websocketService.off('transaction_action_completed', handleActionCompleted);
    };
  }, []);

  return actionResults;
}

// Hook for transaction monitoring updates
export function useTransactionUpdates() {
  const [updates, setUpdates] = useState<any[]>([]);

  useEffect(() => {
    const handleTransactionUpdates = (event: WebSocketEvent) => {
      const { userId, updatedTransactions, newTransactions, updatedCount, newCount } = event.data;
      
      setUpdates(prev => [
        {
          userId,
          updatedTransactions,
          newTransactions,
          updatedCount,
          newCount,
          timestamp: event.timestamp
        },
        ...prev.slice(0, 29) // Keep only last 30 update batches
      ]);
    };

    websocketService.on('transaction_updates', handleTransactionUpdates);

    return () => {
      websocketService.off('transaction_updates', handleTransactionUpdates);
    };
  }, []);

  return updates;
}

// Hook specifically for transaction monitoring on a single account
export function useTransactionWebSocketEvents(accountId: number, userId: number) {
  // Auto-refresh callback when WebSocket events arrive
  const setupTransactionListeners = useCallback((refreshCallback: () => void) => {
    // Listen for transaction action completions for this user
    const handleActionCompleted = (event: WebSocketEvent) => {
      if (event.data.userId === userId) {
        console.log('🔄 Refreshing transactions due to action completion:', event.data);
        refreshCallback();
      }
    };

    // Listen for transaction updates from monitoring for this user
    const handleTransactionUpdates = (event: WebSocketEvent) => {
      if (event.data.userId === userId) {
        console.log('🔄 Refreshing transactions due to monitoring updates:', event.data);
        refreshCallback();
      }
    };

    websocketService.on('transaction_action_completed', handleActionCompleted);
    websocketService.on('transaction_updates', handleTransactionUpdates);

    return () => {
      websocketService.off('transaction_action_completed', handleActionCompleted);
      websocketService.off('transaction_updates', handleTransactionUpdates);
    };
  }, [userId]);

  return {
    setupTransactionListeners,
    isConnected: websocketService.isConnected()
  };
}

// Hook for real-time dashboard data
export function useDashboardData() {
  const accountStatuses = useAccountStatusChanges();
  const newTransactions = useNewTransactions();
  const newNotifications = useNewNotifications();
  const stats = useSystemStats();
  const { isConnected } = useWebSocketConnection();

  return {
    accountStatuses,
    recentTransactions: newTransactions.slice(0, 10), // Last 10 transactions
    recentNotifications: newNotifications.slice(0, 5), // Last 5 notifications
    systemStats: stats,
    isConnected
  };
}