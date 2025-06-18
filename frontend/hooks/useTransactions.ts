import { useState, useEffect, useCallback } from 'react';
import { useSocketApi } from './useSocketApi';

// Interfaces
export interface Transaction {
  id: string;
  orderId?: string;
  advertisementId?: string;
  payoutId?: string;
  counterpartyId?: string;
  counterpartyName?: string;
  amount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  chatStartedAt?: Date;
  checkReceivedAt?: Date;
  customStatuses?: any[];
  advertisement?: {
    id: string;
    bybitAdId?: string;
    type: 'buy' | 'sell';
    currency: string;
    fiat: string;
    price: number;
    minOrderAmount: number;
    maxOrderAmount: number;
    availableAmount: number;
    isActive: boolean;
    bybitAccountId?: string;
    bybitAccount?: {
      id: string;
      name: string;
      status: string;
    };
  };
  payout?: {
    id: string;
    gatePayoutId?: number;
    wallet?: string;
    amount?: number;
    status: number;
    gateAccount?: string;
    gateAccountId?: string;
    method?: any;
  };
}

export interface Order {
  id: string;
  orderId: string;
  type: 'buy' | 'sell';
  currency: string;
  fiat: string;
  amount: number;
  price: number;
  status: string;
  counterpartyId: string;
  counterpartyName: string;
  createdAt: Date;
  updatedAt: Date;
  bybitAccountId?: string;
  bybitAccount?: {
    id: string;
    name: string;
    status: string;
  };
}

export interface Advertisement {
  id: string;
  bybitAdId?: string;
  type: 'buy' | 'sell';
  currency: string;
  fiat: string;
  price: number;
  minOrderAmount: number;
  maxOrderAmount: number;
  availableAmount: number;
  isActive: boolean;
  totalAmount?: number;
  frozenAmount?: number;
  completedOrders?: number;
  completionRate?: number;
  paymentMethods?: string[];
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  bybitAccountId?: string;
  bybitAccount?: {
    id: string;
    name: string;
    status: string;
  };
}

export interface Payout {
  id: string;
  gatePayoutId?: number;
  paymentMethodId?: number;
  wallet?: string;
  amountTrader?: any;
  totalTrader?: any;
  status: number;
  approvedAt?: Date;
  expiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  meta?: any;
  method?: any;
  attachments?: any;
  tooltip?: any;
  bank?: any;
  trader?: any;
  gateAccount?: string;
  gateAccountId?: string;
  amount?: number;
  transaction?: Transaction;
}

export interface Filters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilters extends Filters {
  bybitAccountId?: string;
  gateAccountId?: string;
  amountMin?: number;
  amountMax?: number;
}

export interface OrderFilters extends Filters {
  type?: 'buy' | 'sell';
  currency?: string;
  fiat?: string;
  bybitAccountId?: string;
}

export interface AdvertisementFilters extends Filters {
  type?: 'buy' | 'sell';
  currency?: string;
  fiat?: string;
  isActive?: boolean;
  bybitAccountId?: string;
}

export interface PayoutFilters extends Filters {
  status?: number;
  gateAccountId?: string;
  wallet?: string;
  amountMin?: number;
  amountMax?: number;
}

export function useTransactions() {
  // Virtual Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsTotalCount, setTransactionsTotalCount] = useState(0);
  const [transactionsTotalPages, setTransactionsTotalPages] = useState(0);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionsFilters, setTransactionsFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);
  const [ordersTotalPages, setOrdersTotalPages] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersFilters, setOrdersFilters] = useState<OrderFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Advertisements
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [advertisementsTotalCount, setAdvertisementsTotalCount] = useState(0);
  const [advertisementsTotalPages, setAdvertisementsTotalPages] = useState(0);
  const [advertisementsLoading, setAdvertisementsLoading] = useState(false);
  const [advertisementsError, setAdvertisementsError] = useState<string | null>(null);
  const [advertisementsFilters, setAdvertisementsFilters] = useState<AdvertisementFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Payouts
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsTotalCount, setPayoutsTotalCount] = useState(0);
  const [payoutsTotalPages, setPayoutsTotalPages] = useState(0);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [payoutsFilters, setPayoutsFilters] = useState<PayoutFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const { api, isConnected } = useSocketApi();

  // Load Virtual Transactions
  const loadTransactions = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping transactions load');
      return;
    }

    setTransactionsLoading(true);
    setTransactionsError(null);

    try {
      console.log('Loading transactions with filters:', transactionsFilters);
      const response = await api.emit('transactions:list', transactionsFilters);
      console.log('Transactions response:', response);
      
      if (response.success) {
        setTransactions(response.data.data || []);
        setTransactionsTotalCount(response.data.total || 0);
        setTransactionsTotalPages(response.data.totalPages || 0);
      } else {
        setTransactionsError(response.error?.message || 'Failed to load transactions');
      }
    } catch (err) {
      setTransactionsError('Failed to load transactions');
      console.error('Error loading transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [api, isConnected, transactionsFilters]);

  // Load Orders
  const loadOrders = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping orders load');
      return;
    }

    setOrdersLoading(true);
    setOrdersError(null);

    try {
      console.log('Loading orders with filters:', ordersFilters);
      // Try to load from transactions with orderId
      const response = await api.emit('transactions:list', {
        ...ordersFilters,
        hasOrderId: true
      });
      console.log('Orders response:', response);
      
      if (response.success && response.data) {
        // Transform transactions to orders format
        const ordersData = response.data.data || [];
        setOrders(ordersData);
        setOrdersTotalCount(response.data.total || 0);
        setOrdersTotalPages(response.data.totalPages || 0);
      } else {
        // If no specific orders endpoint, use empty data
        setOrders([]);
        setOrdersTotalCount(0);
        setOrdersTotalPages(0);
      }
    } catch (err) {
      setOrdersError('Failed to load orders');
      console.error('Error loading orders:', err);
      setOrders([]);
      setOrdersTotalCount(0);
      setOrdersTotalPages(0);
    } finally {
      setOrdersLoading(false);
    }
  }, [api, isConnected, ordersFilters]);

  // Load Advertisements
  const loadAdvertisements = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping advertisements load');
      return;
    }

    setAdvertisementsLoading(true);
    setAdvertisementsError(null);

    try {
      console.log('Loading advertisements with filters:', advertisementsFilters);
      const response = await api.emit('advertisements:list', advertisementsFilters);
      console.log('Advertisements response:', response);
      
      if (response.success) {
        setAdvertisements(response.data.data || []);
        setAdvertisementsTotalCount(response.data.total || 0);
        setAdvertisementsTotalPages(response.data.totalPages || 0);
      } else {
        setAdvertisementsError(response.error?.message || 'Failed to load advertisements');
      }
    } catch (err) {
      setAdvertisementsError('Failed to load advertisements');
      console.error('Error loading advertisements:', err);
    } finally {
      setAdvertisementsLoading(false);
    }
  }, [api, isConnected, advertisementsFilters]);

  // Load Payouts
  const loadPayouts = useCallback(async () => {
    if (!isConnected) {
      console.log('Socket not connected, skipping payouts load');
      return;
    }

    setPayoutsLoading(true);
    setPayoutsError(null);

    try {
      // Send proper filters for the payout controller
      const filters = {
        ...payoutsFilters,
        minAmount: payoutsFilters.amountMin,
        maxAmount: payoutsFilters.amountMax,
        // Remove the frontend-specific fields
        amountMin: undefined,
        amountMax: undefined
      };
      
      console.log('Loading payouts with filters:', filters);
      const response = await api.emit('payouts:list', filters);
      console.log('Payouts response:', response);
      
      if (response.success) {
        setPayouts(response.data.data || []);
        setPayoutsTotalCount(response.data.total || 0);
        setPayoutsTotalPages(response.data.totalPages || 0);
      } else {
        setPayoutsError(response.error?.message || 'Failed to load payouts');
      }
    } catch (err) {
      setPayoutsError('Failed to load payouts');
      console.error('Error loading payouts:', err);
    } finally {
      setPayoutsLoading(false);
    }
  }, [api, isConnected, payoutsFilters]);

  // Update filters functions
  const updateTransactionsFilters = useCallback((newFilters: Partial<TransactionFilters>) => {
    setTransactionsFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  const updateOrdersFilters = useCallback((newFilters: Partial<OrderFilters>) => {
    setOrdersFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  const updateAdvertisementsFilters = useCallback((newFilters: Partial<AdvertisementFilters>) => {
    setAdvertisementsFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  const updatePayoutsFilters = useCallback((newFilters: Partial<PayoutFilters>) => {
    setPayoutsFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || (Object.keys(newFilters).some(k => k !== 'page') ? 1 : prev.page)
    }));
  }, []);

  // Load data when connected or filters change
  useEffect(() => {
    if (isConnected) {
      loadTransactions();
    }
  }, [isConnected, loadTransactions]);

  useEffect(() => {
    if (isConnected) {
      loadOrders();
    }
  }, [isConnected, loadOrders]);

  useEffect(() => {
    if (isConnected) {
      loadAdvertisements();
    }
  }, [isConnected, loadAdvertisements]);

  useEffect(() => {
    if (isConnected) {
      loadPayouts();
    }
  }, [isConnected, loadPayouts]);

  return {
    // Virtual Transactions
    transactions,
    transactionsLoading,
    transactionsError,
    transactionsFilters,
    updateTransactionsFilters,
    loadTransactions,
    transactionsTotalCount,
    transactionsTotalPages,
    
    // Orders
    orders,
    ordersLoading,
    ordersError,
    ordersFilters,
    updateOrdersFilters,
    loadOrders,
    ordersTotalCount,
    ordersTotalPages,
    
    // Advertisements
    advertisements,
    advertisementsLoading,
    advertisementsError,
    advertisementsFilters,
    updateAdvertisementsFilters,
    loadAdvertisements,
    advertisementsTotalCount,
    advertisementsTotalPages,
    
    // Payouts
    payouts,
    payoutsLoading,
    payoutsError,
    payoutsFilters,
    updatePayoutsFilters,
    loadPayouts,
    payoutsTotalCount,
    payoutsTotalPages,
  };
}