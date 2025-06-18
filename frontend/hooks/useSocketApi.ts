import { useEffect, useState, useCallback } from 'react';
import socketApi, { ApiResponse } from '@/services/socket-api';
import { useAuthStore } from '@/store/auth';

interface UseSocketApiOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: (attemptNumber: number) => void;
}

export function useSocketApi(options?: UseSocketApiOptions) {
  const [isConnected, setIsConnected] = useState(socketApi.isConnected());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    // Initialize socket API when component mounts
    if (token) {
      socketApi.initialize().catch(console.error);
    }

    // Connection status handlers
    const handleConnect = () => {
      setIsConnected(true);
      options?.onConnect?.();
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      options?.onDisconnect?.();
    };

    const handleReconnect = (attemptNumber: number) => {
      setIsConnected(true);
      options?.onReconnect?.(attemptNumber);
    };

    // Subscribe to connection events
    socketApi.on('connect', handleConnect);
    socketApi.on('disconnect', handleDisconnect);
    socketApi.on('reconnect', handleReconnect);

    // Check initial connection status
    setIsConnected(socketApi.isConnected());

    return () => {
      // Cleanup
      socketApi.off('connect', handleConnect);
      socketApi.off('disconnect', handleDisconnect);
      socketApi.off('reconnect', handleReconnect);
    };
  }, [token, options]);

  // Generic API call wrapper
  const call = useCallback(async <T = any>(
    apiCall: () => Promise<ApiResponse<T>>
  ): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      if (response.success && response.data !== undefined) {
        return response.data;
      } else {
        setError(response.error?.message || 'Unknown error occurred');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to real-time events
  const subscribe = useCallback((event: string, handler: Function) => {
    socketApi.on(event, handler);
    return () => socketApi.off(event, handler);
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    call,
    subscribe,
    api: socketApi,
    // Direct access to API namespaces
    accounts: socketApi.accounts,
    transactions: socketApi.transactions,
    payouts: socketApi.payouts,
    advertisements: socketApi.advertisements,
    rates: socketApi.rates,
    chats: socketApi.chats,
    templates: socketApi.templates,
    orchestrator: socketApi.orchestrator,
  };
}