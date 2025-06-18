"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { socketApi } from '@/services/socket-api';

interface GateAccount {
  id: number;
  email: string;
  status: string;
  errorMessage?: string;
  lastCheckAt?: string;
  nextUpdateAt?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
  };
}

interface DashboardStats {
  graph: Array<{
    total: number;
    turnover: string;
    debited: string;
    turnover_usdt: string;
    debited_usdt: string;
    successes: number;
    cancelled: number;
    expired: number;
    rejected: number;
    date: string;
  }>;
  avg: {
    payments: Array<{
      amount: number;
      time: string;
      day: string;
    }>;
  };
  stepType: string;
  lastUpdated: string;
}

export function useGateAccounts() {
  const [accounts, setAccounts] = useState<GateAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await socketApi.accounts.listGateAccounts();
      if (response.success && response.data) {
        setAccounts(response.data.data || []);
      } else {
        setError(response.error?.message || 'Failed to fetch accounts');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching Gate accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts
  };
}

export function useGateDashboardStats(accountId: number, stepType: string = 'day') {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!accountId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Implement dashboard stats in socket API
      console.warn('Dashboard stats not yet implemented in socket API');
      setError('Dashboard stats not available');
    } catch (err) {
      setError('Network error');
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [accountId, stepType]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
}

export function useGateAccountData(accountId: number) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [smsMessages, setSmsMessages] = useState<any[]>([]);
  const [pushNotifications, setPushNotifications] = useState<any[]>([]);
  const [totalCounts, setTotalCounts] = useState({
    transactions: 0,
    sms: 0,
    push: 0,
    pendingTransactions: 0,
    inProcessTransactions: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchTimeoutRef = useRef<NodeJS.Timeout>();

  const fetchData = useCallback(async () => {
    if (!accountId) return;
    
    // Clear existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    // Debounce requests to avoid duplicates
    fetchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      
      try {
        // TODO: Implement these endpoints in socket API
        const [transactionsRes, smsRes, pushRes, statsRes] = await Promise.all([
          Promise.resolve({ success: true, data: { items: [] } }),
          Promise.resolve({ success: true, data: { items: [] } }),
          Promise.resolve({ success: true, data: { items: [] } }),
          Promise.resolve({ success: true, data: { totalTransactions: 0, totalSms: 0, totalPush: 0, pendingTransactions: 0, inProcessTransactions: 0 } })
        ]);

        if (transactionsRes.success && transactionsRes.data) {
          const data = (transactionsRes.data as any);
          setTransactions(data?.items || []);
        }
        
        if (smsRes.success && smsRes.data) {
          const data = (smsRes.data as any);
          setSmsMessages(data?.items || []);
        }
        
        if (pushRes.success && pushRes.data) {
          const data = (pushRes.data as any);
          setPushNotifications(data?.items || []);
        }

        if (statsRes.success && statsRes.data) {
          const data = statsRes.data as any;
          setTotalCounts({
            transactions: data.totalTransactions || 0,
            sms: data.totalSms || 0,
            push: data.totalPush || 0,
            pendingTransactions: data.pendingTransactions || 0,
            inProcessTransactions: data.inProcessTransactions || 0
          });
        }
      } catch (err) {
        console.error('Error fetching account data:', err);
      } finally {
        setLoading(false);
      }
    }, 100); // Debounce for 100ms
  }, [accountId]);

  const triggerSync = async () => {
    try {
      // TODO: Implement sync in socket API
      console.warn('Sync not yet implemented in socket API');
      return false;
    } catch (err) {
      console.error('Error triggering sync:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchData();
    
    // Cleanup function
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchData]);

  return {
    transactions,
    smsMessages,
    pushNotifications,
    totalCounts,
    loading,
    refetch: fetchData,
    triggerSync
  };
}