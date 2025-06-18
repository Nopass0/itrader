import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import { useAccountStatusChanges, useBalanceUpdates } from './useWebSocketEvents';
import { socketApi } from '@/services/socket-api';

export interface GateAccount {
  id: string;
  accountId: string;
  accountName?: string;
  email: string;
  status: 'initializing' | 'active' | 'error' | 'disabled';
  errorMessage?: string;
  lastSync?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckAt?: string;
  nextUpdateAt?: string;
  user?: {
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
  id: string;
  accountId: string;
  accountName?: string;
  apiKey: string;
  status: 'initializing' | 'active' | 'error' | 'disabled';
  errorMessage?: string;
  lastSync?: string;
  isActive: boolean;
  activeAdsCount?: number;
  createdAt: string;
  updatedAt: string;
  lastCheckAt?: string;
  user?: {
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
  accountInfo?: any;  // Contains enriched account info including UID, email, and p2pInfo
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
      const response = await socketApi.accounts.listGateAccounts();
      
      if (response.success && response.data) {
        // Map the data to match our interface
        const accountsData = (response.data.data || []).map((account: any) => ({
          ...account,
          status: account.isActive ? 'active' : 'disabled',
          lastCheckAt: account.lastSync
        }));
        setAccounts(accountsData);
        setError(null);
      } else {
        setError(response.error?.message || 'Failed to fetch accounts');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    try {
      const response = await socketApi.accounts.deleteGateAccount(accountId);
      
      if (response.success) {
        setAccounts(prev => prev.filter(account => account.id !== accountId));
        return true;
      } else {
        setError(response.error?.message || 'Failed to delete account');
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
      const response = await socketApi.accounts.listBybitAccounts();
      
      if (response.success && response.data) {
        // Map the data to match our interface
        const accountsData = (response.data.data || []).map((account: any) => ({
          ...account,
          status: account.isActive ? 'active' : 'disabled',
          lastCheckAt: account.lastSync
        }));
        setAccounts(accountsData);
        setError(null);
      } else {
        setError(response.error?.message || 'Failed to fetch accounts');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    try {
      const response = await socketApi.accounts.deleteBybitAccount(accountId);
      
      if (response.success) {
        setAccounts(prev => prev.filter(account => account.id !== accountId));
        return true;
      } else {
        setError(response.error?.message || 'Failed to delete account');
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
      // For now, we'll use empty arrays as the socket API doesn't have these specific endpoints yet
      // TODO: Implement these endpoints in the socket API
      const [balancesRes, adsRes, ordersRes] = await Promise.all([
        Promise.resolve({ success: true, data: { balances: [] } }),
        Promise.resolve({ success: true, data: { ads: [] } }),
        Promise.resolve({ success: true, data: { orders: [] } })
      ]);

      if (balancesRes.success && balancesRes.data) {
        const balanceData = balancesRes.data as any;
        setBalances(balanceData.balances || balanceData || []);
      }
      
      if (adsRes.success && adsRes.data) {
        const adsData = adsRes.data as any;
        setAds(adsData.ads || adsData || []);
      }
      
      if (ordersRes.success && ordersRes.data) {
        const ordersData = ordersRes.data as any;
        setOrders(ordersData.orders || ordersData || []);
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
      // TODO: Implement sync endpoint in socket API
      console.warn('Sync endpoint not yet implemented in socket API');
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
      const response = await socketApi.advertisements.create({
        bybitAccountId: accountId.toString(),
        type: adData.side.toLowerCase() as 'buy' | 'sell',
        currency: adData.tokenId,
        fiat: adData.currencyId,
        price: parseFloat(adData.price),
        minAmount: parseFloat(adData.minAmount),
        maxAmount: parseFloat(adData.maxAmount),
        quantity: adData.amount,
        paymentMethods: adData.paymentMethodIds,
        description: adData.remark
      });
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error?.message };
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
      const updateData: any = { id: adData.itemId };
      if (adData.price) updateData.price = parseFloat(adData.price);
      if (adData.minAmount) updateData.minAmount = parseFloat(adData.minAmount);
      if (adData.maxAmount) updateData.maxAmount = parseFloat(adData.maxAmount);
      if (adData.remark) updateData.description = adData.remark;
      
      const response = await socketApi.advertisements.update(adData.itemId, updateData);
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error?.message };
    } catch (err: any) {
      console.error('Error updating ad:', err);
      return { success: false, error: err.message };
    }
  };

  const removeAd = async (adId: string) => {
    try {
      const response = await socketApi.advertisements.delete(adId);
      if (response.success) {
        await fetchData(); // Refresh data
        return { success: true };
      }
      return { success: false, error: response.error?.message };
    } catch (err: any) {
      console.error('Error removing ad:', err);
      return { success: false, error: err.message };
    }
  };

  const markOrderAsPaid = async (orderId: string) => {
    try {
      // TODO: Implement in socket API
      console.warn('Mark order as paid not yet implemented in socket API');
      return { success: false, error: 'Not implemented' };
    } catch (err: any) {
      console.error('Error marking order as paid:', err);
      return { success: false, error: err.message };
    }
  };

  const releaseAsset = async (orderId: string) => {
    try {
      // TODO: Implement in socket API
      console.warn('Release asset not yet implemented in socket API');
      return { success: false, error: 'Not implemented' };
    } catch (err: any) {
      console.error('Error releasing asset:', err);
      return { success: false, error: err.message };
    }
  };

  const getChatMessages = async (orderId: string) => {
    try {
      // TODO: Implement in socket API
      console.warn('Get chat messages not yet implemented in socket API');
      return { success: false, error: 'Not implemented' };
    } catch (err: any) {
      console.error('Error getting chat messages:', err);
      return { success: false, error: err.message };
    }
  };

  const sendChatMessage = async (orderId: string, content: string) => {
    try {
      // TODO: Implement in socket API
      console.warn('Send chat message not yet implemented in socket API');
      return { success: false, error: 'Not implemented' };
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