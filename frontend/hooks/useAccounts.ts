import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useAccountStatusChanges, useBalanceUpdates } from './useWebSocketEvents';

export interface GateAccount {
  id: number;
  email: string;
  status: 'initializing' | 'active' | 'error' | 'disabled';
  errorMessage?: string;
  lastCheckAt?: string;
  nextUpdateAt?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
  };
  balance?: {
    USDT: number;
    BTC: number;
    ETH: number;
  };
  orders?: number;
  trades?: number;
}

export interface BybitAccount {
  id: number;
  apiKey: string;
  status: 'initializing' | 'active' | 'error' | 'disabled';
  errorMessage?: string;
  lastCheckAt?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
  };
  balance?: {
    USDT: number;
    BTC: number;
    ETH: number;
  };
  positions?: number;
  orders?: number;
}

export function useGateAccounts() {
  const [accounts, setAccounts] = useState<GateAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMockMode } = useAuthStore();
  
  // WebSocket integration
  const accountStatuses = useAccountStatusChanges();
  const balanceUpdates = useBalanceUpdates();

  const fetchAccounts = async () => {
    if (isMockMode) {
      // Return mock data in mock mode
      setAccounts([
        {
          id: 1,
          email: 'demo@gate.cx',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: 1, username: 'demo' },
          balance: { USDT: 1234.56, BTC: 0.05, ETH: 2.1 },
          orders: 3,
          trades: 25
        }
      ]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.get('/gate/accounts');
      
      if (response.success) {
        setAccounts((response.data as any)?.items || []);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch accounts');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (accountId: number) => {
    try {
      const response = await apiClient.delete(`/gate/accounts/${accountId}`);
      
      if (response.success) {
        setAccounts(prev => prev.filter(account => account.id !== accountId));
        return true;
      } else {
        setError(response.error || 'Failed to delete account');
        return false;
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
      return false;
    }
  };

  // Update accounts when WebSocket events are received
  useEffect(() => {
    if (!isMockMode && accounts.length > 0) {
      setAccounts(prevAccounts => 
        prevAccounts.map(account => {
          const statusUpdate = accountStatuses.get(account.id);
          const balanceUpdate = balanceUpdates.get(account.id);
          
          let updatedAccount = { ...account };
          
          // Apply status updates
          if (statusUpdate && statusUpdate.platform === 'gate') {
            updatedAccount = {
              ...updatedAccount,
              status: statusUpdate.status,
              errorMessage: statusUpdate.errorMessage,
              updatedAt: statusUpdate.updatedAt
            };
          }
          
          // Apply balance updates
          if (balanceUpdate && balanceUpdate.platform === 'gate') {
            updatedAccount = {
              ...updatedAccount,
              balance: balanceUpdate.balances
            };
          }
          
          return updatedAccount;
        })
      );
    }
  }, [accountStatuses, balanceUpdates, accounts.length, isMockMode]);

  useEffect(() => {
    fetchAccounts();
  }, [isMockMode]);

  return {
    accounts,
    isLoading,
    error,
    refetch: fetchAccounts,
    deleteAccount
  };
}

export function useBybitAccounts() {
  const [accounts, setAccounts] = useState<BybitAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isMockMode } = useAuthStore();
  
  // WebSocket integration
  const accountStatuses = useAccountStatusChanges();
  const balanceUpdates = useBalanceUpdates();

  const fetchAccounts = async () => {
    if (isMockMode) {
      // Return mock data in mock mode
      setAccounts([
        {
          id: 1,
          apiKey: 'demo_key...',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: 1, username: 'demo' }
        }
      ]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.get('/bybit/accounts');
      
      if (response.success) {
        setAccounts((response.data as any)?.items || []);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch accounts');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (accountId: number) => {
    try {
      const response = await apiClient.delete(`/bybit/accounts/${accountId}`);
      
      if (response.success) {
        setAccounts(prev => prev.filter(account => account.id !== accountId));
        return true;
      } else {
        setError(response.error || 'Failed to delete account');
        return false;
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
      return false;
    }
  };

  // Update accounts when WebSocket events are received
  useEffect(() => {
    if (!isMockMode && accounts.length > 0) {
      setAccounts(prevAccounts => 
        prevAccounts.map(account => {
          const statusUpdate = accountStatuses.get(account.id);
          const balanceUpdate = balanceUpdates.get(account.id);
          
          let updatedAccount = { ...account };
          
          // Apply status updates
          if (statusUpdate && statusUpdate.platform === 'bybit') {
            updatedAccount = {
              ...updatedAccount,
              status: statusUpdate.status,
              errorMessage: statusUpdate.errorMessage,
              updatedAt: statusUpdate.updatedAt
            };
          }
          
          // Apply balance updates
          if (balanceUpdate && balanceUpdate.platform === 'bybit') {
            updatedAccount = {
              ...updatedAccount,
              balance: balanceUpdate.balances
            };
          }
          
          return updatedAccount;
        })
      );
    }
  }, [accountStatuses, balanceUpdates, accounts.length, isMockMode]);

  useEffect(() => {
    fetchAccounts();
  }, [isMockMode]);

  return {
    accounts,
    isLoading,
    error,
    refetch: fetchAccounts,
    deleteAccount
  };
}

// Bybit account data hook
export function useBybitAccountData(accountId: number) {
  const [balances, setBalances] = useState<BybitBalance[]>([]);
  const [ads, setAds] = useState<BybitAd[]>([]);
  const [orders, setOrders] = useState<BybitOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!accountId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [balancesRes, adsRes, ordersRes] = await Promise.all([
        apiClient.get(`/bybit/accounts/${accountId}/balances`),
        apiClient.get(`/bybit/accounts/${accountId}/ads`),
        apiClient.get(`/bybit/accounts/${accountId}/orders`)
      ]);

      if (balancesRes.success && balancesRes.data) {
        setBalances(balancesRes.data);
      }
      
      if (adsRes.success && adsRes.data) {
        setAds(adsRes.data);
      }
      
      if (ordersRes.success && ordersRes.data) {
        setOrders(ordersRes.data);
      }
      
    } catch (err) {
      setError('Failed to fetch account data');
      console.error('Error fetching Bybit account data:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const syncData = async () => {
    try {
      const response = await apiClient.post(`/bybit/accounts/${accountId}/sync`);
      if (response.success) {
        // Refresh data after sync
        setTimeout(fetchData, 2000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error syncing Bybit account:', err);
      return false;
    }
  };

  const createAd = async (adData: {
    side: 'Buy' | 'Sell';
    tokenId: string;
    currencyId: string;
    price: string;
    amount: string;
    minAmount: string;
    maxAmount: string;
    paymentMethodIds: string[];
    remark?: string;
  }) => {
    try {
      const response = await apiClient.post(`/bybit/accounts/${accountId}/ads`, adData);
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error };
    } catch (err: any) {
      console.error('Error creating ad:', err);
      return { success: false, error: err.message };
    }
  };

  const updateAd = async (adData: {
    itemId: string;
    price?: string;
    amount?: string;
    minAmount?: string;
    maxAmount?: string;
    remark?: string;
  }) => {
    try {
      const response = await apiClient.put(`/bybit/accounts/${accountId}/ads`, adData);
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error };
    } catch (err: any) {
      console.error('Error updating ad:', err);
      return { success: false, error: err.message };
    }
  };

  const removeAd = async (adId: string) => {
    try {
      const response = await apiClient.delete(`/bybit/ads/${adId}`);
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (err: any) {
      console.error('Error removing ad:', err);
      return { success: false, error: err.message };
    }
  };

  const markOrderAsPaid = async (orderId: string) => {
    try {
      const response = await apiClient.post(`/bybit/orders/${orderId}/pay`);
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (err: any) {
      console.error('Error marking order as paid:', err);
      return { success: false, error: err.message };
    }
  };

  const releaseAsset = async (orderId: string) => {
    try {
      const response = await apiClient.post(`/bybit/orders/${orderId}/release`);
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (err: any) {
      console.error('Error releasing asset:', err);
      return { success: false, error: err.message };
    }
  };

  const getChatMessages = async (orderId: string) => {
    try {
      const response = await apiClient.get(`/bybit/orders/${orderId}/chat`);
      if (response.success) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error };
    } catch (err: any) {
      console.error('Error getting chat messages:', err);
      return { success: false, error: err.message };
    }
  };

  const sendChatMessage = async (orderId: string, content: string) => {
    try {
      const response = await apiClient.post(`/bybit/orders/${orderId}/chat`, { content });
      if (response.success) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error };
    } catch (err: any) {
      console.error('Error sending chat message:', err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    balances,
    ads,
    orders,
    loading,
    error,
    refetch: fetchData,
    syncData,
    createAd,
    updateAd,
    removeAd,
    markOrderAsPaid,
    releaseAsset,
    getChatMessages,
    sendChatMessage
  };
}

interface BybitBalance {
  id: number;
  coin: string;
  balance: string;
  frozen: string;
  createdAt: string;
  updatedAt: string;
}

interface BybitAd {
  id: string;
  side: 'Buy' | 'Sell';
  tokenId: string;
  currencyId: string;
  price: string;
  amount: string;
  minAmount: string;
  maxAmount: string;
  paymentMethods: any[];
  remark?: string;
  status: string;
  completedOrderNum: number;
  completedRate: string;
  avgReleaseTime: string;
  createdAt: string;
  updatedAt: string;
}

interface BybitOrder {
  id: string;
  orderStatus: string;
  side: 'Buy' | 'Sell';
  tokenId: string;
  currencyId: string;
  price: string;
  amount: string;
  quantity: string;
  paymentMethod: any;
  counterPartyId: string;
  counterPartyNickName: string;
  adId: string;
  chatId: string;
  lastUpdateTime: string;
  createdAt: string;
  updatedAt: string;
}